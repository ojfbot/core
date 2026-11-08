import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { CONSOLE_HTML } from "../console.js";
import { statusView } from "../status.js";
const script = /<script>([\s\S]*)<\/script>/.exec(CONSOLE_HTML)![1]!;
class Element {
  textContent = "";
  children: Element[] = [];
  click: (() => void) | undefined;
  append(node: Element) {
    this.children.push(node);
  }
  replaceChildren() {
    this.children = [];
  }
  addEventListener(_event: string, listener: () => void) {
    this.click = listener;
  }
  set innerHTML(_value: string) {
    throw Error("unsafe HTML sink");
  }
}
const snapshot = (at: number, cursor = 2) => ({
  schemaVersion: 1 as const,
  revision: `fixture-${cursor}`,
  generatedAt: at,
  cursor,
  service: {
    id: "fixture",
    starts: 1,
    trackedSince: at,
    startedAt: at,
    version: "fixture",
    build: "unknown",
    ready: true,
    reasons: [],
    uptimeSeconds: 0,
  },
  queue: { ready: 0, claimed: 0, done: 1, failed: 0 },
  leases: { active: 0, expired: 0 },
  kinds: [],
  workers: [
    {
      id: "yuri",
      seenAt: at,
      freshness: "fresh" as const,
      phase: "idle",
      eligibility: "eligible",
      handlers: ["read-vision"],
      busy: false,
      heldSlots: 0,
      control: { paused: false, revision: 0, intent: "resume" as const },
    },
  ],
  events: [],
  backup: { state: "unqualified" as const, lastVerifiedAt: null },
});
it("uses one revision for CLI/browser projections; fails stale on outage, old or reordered snapshots", async () => {
  const nodes = new Map<string, Element>();
  let tick: (() => Promise<void>) | undefined;
  let value: unknown = snapshot(Date.now());
  let outage = false;
  const document = {
    getElementById: (id: string) => {
      if (!nodes.has(id)) nodes.set(id, new Element());
      return nodes.get(id);
    },
    createElement: () => new Element(),
  };
  runInNewContext(script, {
    document,
    Date,
    JSON,
    Number,
    Math,
    String,
    Error,
    AbortSignal,
    setInterval: (f: () => Promise<void>) => {
      tick = f;
    },
    fetch: async () => {
      if (outage) throw Error("synthetic outage");
      return { ok: true, json: async () => value };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  expect(nodes.get("health")!.textContent).toBe("Service ready");
  expect(nodes.get("revision")!.textContent).toContain(
    statusView(value as ReturnType<typeof snapshot>, "status").revision,
  );
  await tick!();
  expect(nodes.get("workers")!.children).toHaveLength(1);
  outage = true;
  await tick!();
  expect(nodes.get("health")!.textContent).toContain("stale");
  expect(nodes.get("workers")!.children).toHaveLength(0);
  outage = false;
  value = snapshot(Date.now() - 6000);
  await tick!();
  expect(nodes.get("health")!.textContent).toContain("stale");
  value = snapshot(Date.now(), 1);
  await tick!();
  expect(nodes.get("health")!.textContent).toContain("stale");
  value = snapshot(Date.now(), 3);
  (value as ReturnType<typeof snapshot>).workers[0]!.id = '<img src=x onerror="bad()">';
  await tick!();
  expect(nodes.get("workers")!.children[0]!.children[0]!.textContent).toBe(
    '<img src=x onerror="bad()">',
  );
});
