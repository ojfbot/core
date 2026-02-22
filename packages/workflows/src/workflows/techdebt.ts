import fs from "node:fs/promises";
import path from "node:path";
import { callClaude } from "../llm.js";
import { applyUnifiedDiff } from "../utils/diff.js";
import type { WorkflowSpec } from "../types.js";
import type { TechDebtIncident, TechDebtProposal } from "./techdebt/schema.js";

// Directories that /techdebt is allowed to patch (repo-relative, forward slash)
const ALLOWED_ROOTS = [
  "packages/workflows/",
  "domain-knowledge/",
  "skills/",
];

function isAllowedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\//, "");
  return ALLOWED_ROOTS.some((root) => normalized.startsWith(root));
}

const SYSTEM_PROMPT = `\
You are a meta-engineer for a Claude-powered workflow automation framework.
Your job is to analyze incidents that occurred during workflow execution and produce structured improvement proposals.

Rules:
- You MUST output ONLY valid JSON — no markdown, no explanation, no code fences.
- You MUST NOT propose changes to production business code (src/**, app/**, or any path outside: packages/workflows/**, domain-knowledge/**, skills/**).
- All filePatches paths must be inside allowed roots: packages/workflows/**, domain-knowledge/**, skills/**.
- Each proposal item should include filePatches whenever a concrete code or content change is warranted.
- Output must conform exactly to the TechDebtProposal TypeScript type.

TechDebtProposal shape (TypeScript, for reference):
{
  incident: TechDebtIncident;           // echo back the input incident
  problemStatement: string;             // 1-3 sentences
  impactAssessment: string;             // 1-3 sentences
  keyLearnings: string[];               // bullet points
  currentResolution: string;            // what was done or should be done immediately
  proposals: Array<{
    kind: "workflow_prompt_change" | "workflow_arg_change" | "skill_action_change"
        | "new_skill_action" | "domain_knowledge_update" | "guardrail" | "monitoring";
    target: string;                     // e.g. "packages/workflows/src/workflows/summarize.ts"
    description: string;
    suggestedChange: string;
    filePatches?: Array<{
      path: string;                     // repo-relative, must be in allowed roots
      unifiedDiff?: string;             // standard unified diff
      newContent?: string;              // full file content (use when creating new file)
    }>;
  }>;
  priority: "low" | "medium" | "high";
  estimatedEffort: "minutes" | "hours" | "days";
}`;

async function handlePropose(
  incident: TechDebtIncident,
  cwd: string,
  includeDomainContext: boolean
): Promise<string> {
  let domainContext = "";

  if (includeDomainContext) {
    const workflowFile = path.join(
      cwd,
      "packages/workflows/src/workflows",
      `${incident.workflowName}.ts`
    );
    try {
      const content = await fs.readFile(workflowFile, "utf-8");
      domainContext = `\n\nCurrent workflow source (${incident.workflowName}.ts):\n\`\`\`typescript\n${content}\n\`\`\``;
    } catch {
      // File may not exist — that's fine
    }
  }

  const userPrompt = `Analyze this incident and produce a TechDebtProposal JSON object.

Incident:
${JSON.stringify(incident, null, 2)}
${domainContext}

Output ONLY the JSON object for TechDebtProposal. No markdown, no explanation.`;

  const raw = await callClaude(SYSTEM_PROMPT, userPrompt, { maxTokens: 8192 });

  // Strip markdown code fences if Claude wrapped the JSON anyway
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  let proposal: TechDebtProposal;
  try {
    proposal = JSON.parse(cleaned) as TechDebtProposal;
  } catch (err) {
    throw new Error(`Failed to parse TechDebtProposal JSON from Claude response.\nRaw:\n${raw}`);
  }

  return JSON.stringify(proposal, null, 2);
}

async function handleApply(
  proposal: TechDebtProposal,
  cwd: string,
  dryRun: boolean,
  selectIndex?: number
): Promise<string> {
  const logs: string[] = [];

  const items =
    selectIndex !== undefined
      ? [proposal.proposals[selectIndex]].filter(Boolean)
      : proposal.proposals;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const proposalIndex = selectIndex !== undefined ? selectIndex : i;

    if (!item.filePatches || item.filePatches.length === 0) {
      logs.push(`INFO  [proposal ${proposalIndex}] "${item.target}" — no filePatches`);
      continue;
    }

    for (const patch of item.filePatches) {
      if (!isAllowedPath(patch.path)) {
        logs.push(`SKIP  [proposal ${proposalIndex}] ${patch.path} (outside allowed roots)`);
        continue;
      }

      const absPath = path.join(cwd, patch.path);

      if (patch.unifiedDiff) {
        let original = "";
        try {
          original = await fs.readFile(absPath, "utf-8");
        } catch {
          // File doesn't exist yet — treat as empty
        }

        const patched = applyUnifiedDiff(original, patch.unifiedDiff);

        if (!dryRun) {
          await fs.mkdir(path.dirname(absPath), { recursive: true });
          await fs.writeFile(absPath, patched, "utf-8");
          logs.push(`APPLIED [proposal ${proposalIndex}] patched ${patch.path} with unified diff`);
        } else {
          logs.push(`DRYRUN  [proposal ${proposalIndex}] would patch ${patch.path} with unified diff`);
        }
      } else if (patch.newContent !== undefined) {
        if (!dryRun) {
          await fs.mkdir(path.dirname(absPath), { recursive: true });
          await fs.writeFile(absPath, patch.newContent, "utf-8");
          logs.push(`APPLIED [proposal ${proposalIndex}] wrote full content to ${patch.path}`);
        } else {
          logs.push(`DRYRUN  [proposal ${proposalIndex}] would write full content to ${patch.path}`);
        }
      } else {
        logs.push(`SKIP  [proposal ${proposalIndex}] ${patch.path} — no unifiedDiff or newContent`);
      }
    }
  }

  return logs.join("\n");
}

export const techDebtWorkflow: WorkflowSpec = {
  name: "techdebt",
  description: "Meta-workflow: propose or apply improvements to the workflow framework",
  usage: [
    "Propose mode:",
    "  /techdebt --mode=propose --incident='{...json...}' [--includeDomainContext]",
    "",
    "Apply mode:",
    "  /techdebt --mode=apply --proposal='{...json...}' [--dryRun] [--select=0]",
    "",
    "Allowed patch targets: packages/workflows/**, domain-knowledge/**, skills/**",
  ].join("\n"),

  async handler({ args, ctx }) {
    const mode = (args.flags.mode as string | undefined) ?? "propose";

    if (mode === "propose") {
      const incidentRaw = args.flags.incident;
      if (!incidentRaw || typeof incidentRaw !== "string") {
        return (
          "Error: --incident is required for mode=propose.\n" +
          "Usage: /techdebt --mode=propose --incident='{...}'"
        );
      }

      let incident: TechDebtIncident;
      try {
        incident = JSON.parse(incidentRaw) as TechDebtIncident;
      } catch {
        return "Error: --incident must be valid JSON.";
      }

      const includeDomainContext = args.flags.includeDomainContext === true;
      return handlePropose(incident, ctx.cwd, includeDomainContext);
    }

    if (mode === "apply") {
      const proposalRaw = args.flags.proposal;
      if (!proposalRaw || typeof proposalRaw !== "string") {
        return (
          "Error: --proposal is required for mode=apply.\n" +
          "Usage: /techdebt --mode=apply --proposal='{...}' [--dryRun] [--select=0]"
        );
      }

      let proposal: TechDebtProposal;
      try {
        proposal = JSON.parse(proposalRaw) as TechDebtProposal;
      } catch {
        return "Error: --proposal must be valid JSON.";
      }

      const dryRun = args.flags.dryRun === true;
      const selectRaw = args.flags.select;
      const selectIndex =
        typeof selectRaw === "string" ? parseInt(selectRaw, 10) : undefined;

      return handleApply(proposal, ctx.cwd, dryRun, selectIndex);
    }

    return `Error: unknown --mode="${mode}". Valid modes: propose, apply.`;
  },
};
