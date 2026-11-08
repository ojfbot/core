import { accessSync, constants, statfsSync } from "node:fs";
import { join } from "node:path";
import { ID } from "./auth.js";
import type { JobStore } from "./jobs.js";
import { validObservation } from "./status.js";

export function statusRoutes(
  store: JobStore,
  options: {
    registry: string;
    outDir: string;
    inputDir?: string;
    workers?: string[];
    observers?: string[];
    build?: string;
  },
) {
  const workers = options.workers ?? ["yuri", "yojimbo"];
  const observers = options.observers ?? ["observer"];
  if (
    workers.length > 32 ||
    observers.length > 32 ||
    [...workers, ...observers].some((id) => !ID.test(id) || id === "owner") ||
    workers.some((id) => observers.includes(id))
  )
    throw Error("invalid-status-roles");
  const instance = store.startStatusInstance();
  const isObserver = (id: string) => observers.includes(id);
  const snapshot = () => {
    const reasons: string[] = [];
    for (const [name, path] of [
      ["output", options.outDir],
      ...(options.inputDir ? [["input", options.inputDir]] : []),
    ]) {
      try {
        accessSync(path!, constants.R_OK | constants.W_OK | constants.X_OK);
        if (statfsSync(path!).bavail === 0) reasons.push(`${name}-full`);
      } catch {
        reasons.push(`${name}-unavailable`);
      }
    }
    for (const id of ["owner", ...workers, ...observers]) {
      try {
        accessSync(join(options.registry, `${id}.pub`), constants.R_OK);
      } catch {
        reasons.push(`verifier-${id}-unavailable`);
      }
    }
    const build =
      options.build && /^[a-f0-9]{7,40}$/.test(options.build) ? options.build : "unknown";
    return store.statusSnapshot(instance, workers, reasons, build);
  };
  const handle = (
    id: string,
    method: string,
    url: URL,
    bytes: Buffer,
  ): { status: number; body: unknown } | undefined => {
    const route = `${method} ${url.pathname}`;
    if (route === "GET /status") {
      if (id !== "owner" && !isObserver(id)) return { status: 403, body: { error: "forbidden" } };
      if (url.search) return { status: 400, body: { error: "invalid-query" } };
      return { status: 200, body: snapshot() };
    }
    if (route === "GET /status/events") {
      if (id !== "owner" && !isObserver(id)) return { status: 403, body: { error: "forbidden" } };
      const after = Number(url.searchParams.get("after") ?? "0");
      if (
        !Number.isSafeInteger(after) ||
        after < 0 ||
        [...url.searchParams.keys()].some((k) => k !== "after")
      )
        return { status: 400, body: { error: "invalid-cursor" } };
      return { status: 200, body: store.publicEvents(after, workers) };
    }
    if (route === "GET /worker-control") {
      if (!workers.includes(id)) return { status: 403, body: { error: "forbidden" } };
      return { status: 200, body: store.workerControl(id) };
    }
    if (route === "POST /worker-status" || route === "POST /control") {
      let body: unknown;
      try {
        body = JSON.parse(bytes.toString("utf8"));
      } catch {
        return { status: 400, body: { error: "invalid-body" } };
      }
      if (route === "POST /worker-status") {
        if (!workers.includes(id)) return { status: 403, body: { error: "forbidden" } };
        if (!validObservation(body)) return { status: 400, body: { error: "invalid-observation" } };
        store.recordPresence(id, body);
        return { status: 200, body: { received: true } };
      }
      if (id !== "owner") return { status: 403, body: { error: "forbidden" } };
      const b = body as { worker?: unknown; action?: unknown } | null;
      if (
        !b ||
        Array.isArray(b) ||
        Object.keys(b).some((k) => !["worker", "action"].includes(k)) ||
        typeof b.worker !== "string" ||
        !workers.includes(b.worker) ||
        !["pause", "drain", "resume"].includes(b.action as string)
      )
        return { status: 400, body: { error: "invalid-control" } };
      return {
        status: 200,
        body: store.controlWorker(b.worker, b.action as "pause" | "drain" | "resume"),
      };
    }
    return undefined;
  };
  return { handle, isObserver };
}
