import { runWorkflow } from "./runner.js";
import type { TechDebtIncident } from "./workflows/techdebt/schema.js";

/**
 * Programmatically trigger /techdebt --mode=propose for an incident.
 * Use this from within other workflows when they encounter errors,
 * unexpected responses, or new patterns worth capturing.
 *
 * @returns Pretty-printed TechDebtProposal JSON string.
 */
export async function logTechDebtIncident(
  incident: TechDebtIncident,
  cwd: string
): Promise<string> {
  const incidentJson = JSON.stringify(incident);
  const raw = `/techdebt --mode=propose --incident=${JSON.stringify(incidentJson)}`;
  return runWorkflow(raw, { cwd });
}
