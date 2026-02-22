export type WorkflowContext = {
  cwd: string;
  selectedText?: string;
  activeFilePath?: string;
  extra?: Record<string, unknown>;
};

export type WorkflowArgs = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

export type WorkflowHandler = (input: {
  args: WorkflowArgs;
  ctx: WorkflowContext;
}) => Promise<string>;

export type WorkflowSpec = {
  name: string;
  description: string;
  usage: string;
  handler: WorkflowHandler;
};

export type WorkflowRegistry = Record<string, WorkflowSpec>;
