export type TechDebtTriggerReason =
  | "error"
  | "unexpected_response"
  | "capability_gap"
  | "new_pattern"
  | "bad_outcome"
  | "manual_review";

export type TechDebtIncident = {
  id?: string;
  timestamp: string;
  workflowName: string;
  workflowVersion?: string;
  triggerReason: TechDebtTriggerReason;
  shortTitle: string;
  contextSummary: string;
  inputSnippet?: string;
  outputSnippet?: string;
  errorMessage?: string;
  environment?: {
    repo?: string;
    branch?: string;
    filePath?: string;
    cwd?: string;
  };
  agentNotes?: string;
};

export type TechDebtFilePatch = {
  path: string;
  unifiedDiff?: string;
  newContent?: string;
};

export type TechDebtProposalItem = {
  kind:
    | "workflow_prompt_change"
    | "workflow_arg_change"
    | "skill_action_change"
    | "new_skill_action"
    | "domain_knowledge_update"
    | "guardrail"
    | "monitoring";
  target: string;
  description: string;
  suggestedChange: string;
  filePatches?: TechDebtFilePatch[];
};

export type TechDebtProposal = {
  incident: TechDebtIncident;
  problemStatement: string;
  impactAssessment: string;
  keyLearnings: string[];
  currentResolution: string;
  proposals: TechDebtProposalItem[];
  priority: "low" | "medium" | "high";
  estimatedEffort: "minutes" | "hours" | "days";
};
