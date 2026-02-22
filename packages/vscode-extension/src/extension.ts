import * as vscode from "vscode";
import { runWorkflow, workflows } from "@ojf/workflows";
import type { WorkflowContext } from "@ojf/workflows";

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("OJF Workflow");

  context.subscriptions.push(
    vscode.commands.registerCommand("ojf.runSlashCommand", runSlashCommand),
    vscode.commands.registerCommand("ojf.listCommands", listCommands)
  );
}

export function deactivate(): void {
  outputChannel?.dispose();
}

async function runSlashCommand(): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: 'Enter a slash command (e.g. /summarize, /techdebt --mode=propose)',
    placeHolder: "/summarize src/app.ts --style=detailed",
    ignoreFocusOut: true,
  });

  if (!input) return;

  const ctx = buildWorkflowContext();

  outputChannel.show(true);
  outputChannel.appendLine(`\n> ${input}`);
  outputChannel.appendLine("─".repeat(60));

  try {
    const result = await runWorkflow(input, ctx);
    outputChannel.appendLine(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`Error: ${message}`);
    vscode.window.showErrorMessage(`OJF workflow error: ${message}`);
  }
}

async function listCommands(): Promise<void> {
  const items = Object.values(workflows).map((w) => ({
    label: `/${w.name}`,
    description: w.description,
    detail: w.usage.split("\n")[0],
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a workflow to run",
    matchOnDescription: true,
  });

  if (!picked) return;

  // Pre-fill the input box with the selected command
  const input = await vscode.window.showInputBox({
    prompt: `Run ${picked.label}`,
    value: picked.label + " ",
    ignoreFocusOut: true,
  });

  if (!input) return;

  const ctx = buildWorkflowContext();
  outputChannel.show(true);
  outputChannel.appendLine(`\n> ${input}`);
  outputChannel.appendLine("─".repeat(60));

  try {
    const result = await runWorkflow(input, ctx);
    outputChannel.appendLine(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`Error: ${message}`);
    vscode.window.showErrorMessage(`OJF workflow error: ${message}`);
  }
}

function buildWorkflowContext(): WorkflowContext {
  const editor = vscode.window.activeTextEditor;
  const workspaceFolder =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

  const ctx: WorkflowContext = { cwd: workspaceFolder };

  if (editor) {
    ctx.activeFilePath = editor.document.uri.fsPath;

    const selection = editor.selection;
    if (!selection.isEmpty) {
      ctx.selectedText = editor.document.getText(selection);
    }
  }

  return ctx;
}
