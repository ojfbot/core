// A "container" of the fake engine that is a REAL fleet-runner server over TLS, from the built
// package, so the Mac's signed status calls are the real ones. EVERYTHING HERE IS SYNTHETIC.
// Environment (from the fake engine): FAKE_PKG, FAKE_ROOT (the service root it mounts), FAKE_BUILD
// (what its status answers as), FAKE_IMAGE, FAKE_PROD_PORT; FAKE_BAD_BUILD_FOR and
// FAKE_OTHER_CERT_FOR name an image whose container answers with another build or certificate.
import { readFileSync } from "node:fs";
import { join } from "node:path";
const pkg = process.env.FAKE_PKG;
const { JobStore } = await import(`${pkg}/dist/jobs.js`);
const { fleetServer } = await import(`${pkg}/dist/server.js`);
const root = process.env.FAKE_ROOT;
const image = process.env.FAKE_IMAGE;
const store = new JobStore(join(root, "state/fleet.sqlite"));
const tls = process.env.FAKE_OTHER_CERT_FOR === image ? process.env.FAKE_OTHER_CERT_DIR : join(root, "tls");
const server = fleetServer(store, {
  registry: join(root, "public-keys"),
  outDir: join(root, "output"),
  workers: ["worker-a", "worker-b"],
  observers: ["observer"],
  build: process.env.FAKE_BAD_BUILD_FOR === image ? "f".repeat(40) : process.env.FAKE_BUILD,
  tls: { cert: readFileSync(join(tls, "server.crt")), key: readFileSync(join(tls, "server.key")) },
});
server.listen(Number(process.env.FAKE_PROD_PORT), "127.0.0.1");
for (const s of ["SIGTERM", "SIGINT"])
  process.once(s, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    server.closeAllConnections();
  });
