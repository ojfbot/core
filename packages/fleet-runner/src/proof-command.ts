import { isAbsolute } from "node:path";
import { writeOutput } from "./jobs.js";

/** Fixed fixture command; arbitrary job text is never interpreted as a command. */
export function proofCommand(envelope: unknown) {
  if (
    !envelope ||
    typeof envelope !== "object" ||
    !("job" in envelope) ||
    !("outDir" in envelope) ||
    typeof envelope.outDir !== "string" ||
    !isAbsolute(envelope.outDir)
  )
    throw Error("invalid-proof-request");
  const job = envelope.job;
  if (
    !job ||
    typeof job !== "object" ||
    !("key" in job) ||
    !("fence" in job) ||
    !("kind" in job) ||
    typeof job.key !== "string" ||
    !/^[a-f0-9]{64}$/.test(job.key) ||
    typeof job.fence !== "number" ||
    !Number.isSafeInteger(job.fence) ||
    job.fence < 1 ||
    job.kind !== "proof-fixture"
  )
    throw Error("invalid-proof-request");
  return writeOutput(
    envelope.outDir,
    { key: job.key, fence: job.fence },
    "fleet NAS qualification v1\n",
  );
}

export function workerPlist(root: string, label: string): string {
  if (!isAbsolute(root) || !/^[a-zA-Z0-9_.-]{1,180}$/.test(label))
    throw Error("invalid-worker-plist");
  const xml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(label)}</string>
<key>ProgramArguments</key><array>
<string>${xml(root)}/worker/current/node</string>
<string>${xml(root)}/worker/current/fleet-runner.mjs</string>
<string>worker</string><string>--settings</string><string>${xml(root)}/fleet-runner.json</string>
</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ExitTimeOut</key><integer>75</integer>
<key>ProcessType</key><string>Background</string>
</dict></plist>\n`;
}
