#!/usr/bin/env node
// Disposable synthetic fixture server for native status latency qualification.
// It never opens or seeds the service's real queue. Run inside the pinned NAS image.
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dist=process.env.FLEET_DIST ?? '/app/dist';
const {JobStore,writeOutput}=await import(pathToFileURL(join(dist,'jobs.js')));
const {fleetServer}=await import(pathToFileURL(join(dist,'server.js')));
const root=mkdtempSync(join(tmpdir(),'fleet-g5-latency-'));const output=join(root,'output');mkdirSync(output);
const store=new JobStore(join(root,'fixture.sqlite'));
for(let i=0;i<10000;i++){
 store.enqueue({kind:'proof-fixture',inputs:[],params:{ordinal:i},payload:null});
 const claim=store.claim('benchmark',[],['proof-fixture']);if(!claim)throw Error('fixture-claim-failed');
 if(!store.complete(claim.key,claim.fence,'benchmark',()=>writeOutput(output,claim,'fixed synthetic status fixture\n')))throw Error('fixture-completion-failed');
 if(i%2500===0)console.log(JSON.stringify({phase:'seeding',completed:i}));
}
for(const worker of ['yuri','yojimbo'])store.recordPresence(worker,{schemaVersion:1,phase:'idle',eligibility:'eligible',handlers:['read-vision'],busy:false});
const host=Object.values(networkInterfaces()).flat().find(i=>i&&!i.internal&&i.family==='IPv4')?.address;if(!host)throw Error('no-private-interface');
const server=fleetServer(store,{registry:process.env.FLEET_PUBLIC_KEYS_DIR??'/run/fleet-runner/public-keys',outDir:output,
 tls:{cert:readFileSync(process.env.FLEET_TLS_CERT),key:readFileSync(process.env.FLEET_TLS_KEY)},build:process.env.FLEET_BUILD_REF??'unknown'});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8787,host,resolve);});
console.log(JSON.stringify({phase:'ready',historicalJobs:10000,workers:2}));
const presence=setInterval(()=>{for(const worker of ['yuri','yojimbo'])store.recordPresence(worker,{schemaVersion:1,phase:'idle',eligibility:'eligible',handlers:['read-vision'],busy:false});},10000);
process.once('SIGTERM',()=>{clearInterval(presence);server.close(()=>store.close());});
