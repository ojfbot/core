import { expect, it } from "vitest";
import { qualificationDiagnostic } from "../../fleet-runner/qualification-diagnostic.mjs";

it("preserves a safe child failure through the parent wrapper", () => {
  expect(
    qualificationDiagnostic(
      { stderr: 'noise\n{"status":"blocked","phase":"status","code":"http-401"}\n' },
      "status",
      "unexpected-error",
    ),
  ).toEqual({ status: "blocked", phase: "status", code: "http-401" });
});
it("classifies refused SSH without forwarding commands or private details", () => {
  const diagnostic = qualificationDiagnostic(
    { stderr: "Connection refused: synthetic-private-detail" },
    "status",
    "unexpected-error",
  );
  expect(diagnostic).toEqual({ status: "blocked", phase: "status", code: "ssh-unavailable" });
  expect(JSON.stringify(diagnostic)).not.toContain("synthetic-private-detail");
});
it("does not trust arbitrary JSON fields or raw child stderr", () => {
  expect(
    qualificationDiagnostic(
      {
        stderr:
          '{"status":"blocked","phase":"synthetic-private-detail","code":"EACCES"}\nsecret-ish synthetic stderr',
      },
      "status",
      "unexpected-error",
    ),
  ).toEqual({ status: "blocked", phase: "status", code: "unexpected-error" });
});
it("reports subprocess timeout without exposing the failed command", () => {
  expect(
    qualificationDiagnostic(
      { killed: true, cmd: "synthetic-private-detail" },
      "after-reboot",
      "unexpected-error",
    ).code,
  ).toBe("subprocess-timeout");
});
