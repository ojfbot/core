import { createServer } from "node:http";
import type { FleetClient } from "./client.js";
import { statusView, currentSnapshot } from "./status.js";
import type { StatusView } from "./status.js";

export const CONSOLE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fleet Runner</title>
<style>body{font:16px system-ui;background:#101823;color:#e5edf8;margin:0}main{max-width:1120px;margin:auto;padding:32px}h1{font-size:30px;margin:0}header{display:flex;justify-content:space-between;align-items:center}p{color:#a9bad0}.badge{padding:8px 14px;border:1px solid #6d8cad;border-radius:20px}section{margin-top:26px;padding:22px;background:#192638;border-radius:12px}h2{font-size:20px;margin-top:0}table{width:100%;text-align:left;border-collapse:collapse}td,th{padding:12px;border-bottom:1px solid #35465c}pre{white-space:pre-wrap;word-break:break-word;font:13px ui-monospace;max-height:320px;overflow:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}@media(max-width:700px){.grid{grid-template-columns:1fr}main{padding:18px}td,th{padding:6px}}button{background:#285da3;color:white;border:0;border-radius:6px;padding:9px 14px;cursor:pointer}</style></head>
<body><main><header><div><h1>Fleet Runner</h1><p>Execution service · read-only operations console</p></div><span class="badge" id="health">Connecting</span></header><p id="revision">No snapshot received</p>
<section><h2>Workers</h2><table><thead><tr><th>Worker</th><th>Freshness</th><th>State</th><th>Why</th><th>Slots</th><th>Handlers</th></tr></thead><tbody id="workers"></tbody></table></section>
<div class="grid"><section><h2>Queue and leases</h2><pre id="queue">Unknown</pre></section><section><h2>Service and recovery</h2><pre id="service">Unknown</pre></section></div>
<section><h2>Recent execution traces</h2><p>Opaque references and event codes; reader content stays private.</p><pre id="events">Unknown</pre></section><section><h2>Worker diagnostics</h2><pre id="logs">Unknown</pre></section><button id="refresh">Refresh now</button></main>
<script>
const byId=id=>document.getElementById(id);let previous=null;let pending=false;
function unavailable(reason){byId('health').textContent='Unavailable / stale';byId('revision').textContent=reason;byId('workers').replaceChildren();for(const id of ['queue','service','events','logs'])byId(id).textContent='Unknown — current snapshot unavailable';}
function render(s){if(s.schemaVersion!==1||!Array.isArray(s.workers)||!s.service||!Number.isFinite(s.generatedAt))throw Error('incompatible');
 if(Date.now()-s.generatedAt>5000||s.generatedAt>Date.now()+5000)throw Error('old snapshot');
 if(previous&&(s.service.starts<previous.service.starts||(s.service.id===previous.service.id&&(s.cursor<previous.cursor||s.generatedAt<previous.generatedAt))))throw Error('reordered snapshot');
 previous=s;byId('health').textContent=s.service.ready?'Service ready':'Service unready';byId('revision').textContent='Snapshot '+s.revision+' · '+new Date(s.generatedAt).toLocaleTimeString();byId('workers').replaceChildren();
 for(const w of s.workers){const tr=document.createElement('tr');for(const text of [w.id,w.freshness+(w.seenAt?' · '+Math.max(0,Math.floor((s.generatedAt-w.seenAt)/1000))+'s ago':' · never seen'),w.phase,w.eligibility,String(w.heldSlots)+' / 1',w.handlers.join(', ')||'unavailable / unknown']){const td=document.createElement('td');td.textContent=text;tr.append(td);}byId('workers').append(tr);}
 byId('queue').textContent=JSON.stringify({jobs:s.queue,byKind:s.kinds,leases:s.leases},null,2);byId('service').textContent=JSON.stringify({version:s.service.version,build:s.service.build,uptimeSeconds:s.service.uptimeSeconds,observedServiceStarts:s.service.starts,startsTrackedSince:s.service.trackedSince,readiness:s.service.reasons,backup:s.backup},null,2);
 byId('events').textContent=JSON.stringify(s.events,null,2);byId('logs').textContent=JSON.stringify(s.workers.filter(w=>w.errorCode).map(w=>({worker:w.id,code:w.errorCode})),null,2);}
async function refresh(){if(pending)return;pending=true;try{const r=await fetch('/snapshot',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('connection');render(await r.json());}catch{unavailable('Service, authentication or snapshot freshness check failed.');}finally{pending=false;}}
byId('refresh').addEventListener('click',refresh);refresh();setInterval(refresh,2000);
</script></body></html>`;

/** Local read-only viewer. The signing key stays in this process, never in browser code or URLs. */
export function consoleServer(client: Pick<FleetClient, "status">, now: () => number = Date.now) {
  const server = createServer(async (req, res) => {
    const address = server.address();
    if (!address || typeof address === "string") {
      res.writeHead(503).end();
      return;
    }
    const host = `127.0.0.1:${address.port}`;
    if (
      req.headers.host !== host ||
      (req.headers.origin && req.headers.origin !== `http://${host}`) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.writeHead(403).end();
      return;
    }
    const headers = {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "content-security-policy":
        "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
    };
    if (req.method !== "GET") {
      res.writeHead(405, headers).end();
      return;
    }
    if (req.url === "/") {
      res
        .writeHead(200, { ...headers, "content-type": "text/html; charset=utf-8" })
        .end(CONSOLE_HTML);
      return;
    }
    const match = /^\/(snapshot|workers|events|logs|doctor)$/.exec(req.url ?? "");
    if (!match) {
      res.writeHead(404, headers).end();
      return;
    }
    try {
      const snapshot = await client.status(AbortSignal.timeout(4000));
      if (!currentSnapshot(snapshot, now())) throw Error("incompatible");
      res
        .writeHead(200, { ...headers, "content-type": "application/json" })
        .end(
          JSON.stringify(
            statusView(snapshot, match[1] === "snapshot" ? "status" : (match[1] as StatusView)),
          ),
        );
    } catch {
      res
        .writeHead(503, { ...headers, "content-type": "application/json" })
        .end('{"error":"status-unavailable"}');
    }
  });
  return server;
}
