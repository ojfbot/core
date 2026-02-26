import type { WorkflowRegistry } from "./types.js";
import { techDebtWorkflow } from "./workflows/techdebt.js";
import { summarizeWorkflow } from "./workflows/summarize.js";
import { workbenchWorkflow } from "./workflows/workbench.js";
import { fileBackedWorkflow } from "./fileBackedWorkflow.js";

// File-backed workflows: prompt lives in .claude/commands/<name>/<name>.md
// Each skill is a directory: <name>.md + knowledge/ (JIT reference) + scripts/ (deterministic utils)
// Single source of truth — updating the .md updates both Claude Code and the CLI.
const fileBacked: WorkflowRegistry = {
  "plan-feature":  fileBackedWorkflow("plan-feature",  "Turn a rough idea or ticket into an implementation-ready spec with acceptance criteria and ADR stub"),
  scaffold:        fileBackedWorkflow("scaffold",       "Generate type definitions, skeleton implementations, and test stubs for a planned feature"),
  investigate:     fileBackedWorkflow("investigate",    "Root-cause analysis: build a cause map and candidate fixes without touching code"),
  validate:        fileBackedWorkflow("validate",       "Pre-merge quality gate: verify spec coverage, invariants, and safety constraints"),
  deploy:          fileBackedWorkflow("deploy",         "Release conductor: summarize what is shipping, pre-flight checks, rollback plan, changelog"),
  handoff:         fileBackedWorkflow("handoff",        "Generate a runbook with architecture, debug guide, and honest open items for a module or feature"),
  hardening:       fileBackedWorkflow("hardening",      "Identify security, resilience, and observability gaps with prioritized fix suggestions"),
  "doc-refactor":  fileBackedWorkflow("doc-refactor",   "Normalize README, docs/ structure, ADRs, and Mermaid diagrams to reflect current system"),
  "test-expand":   fileBackedWorkflow("test-expand",    "Identify untested branches and propose specific new unit/integration tests"),
  sweep:           fileBackedWorkflow("sweep",          "Batch maintenance pass: stale TODOs, unused imports, debug logs, config duplication"),
  "push-all":      fileBackedWorkflow("push-all",       "Safe commit with secret scanning, branch protection checks, and smart commit messages"),
  "setup-ci-cd":   fileBackedWorkflow("setup-ci-cd",    "One-shot CI/CD setup: pre-commit hooks, GitHub Actions CI + security workflows, coverage gates"),
  recon:             fileBackedWorkflow("recon",            "Reconnaissance report: structure, entry points, stack, architecture patterns, notable observations"),
  roadmap:           fileBackedWorkflow("roadmap",          "Generate or update a product roadmap with priorities, effort estimates, and dependencies"),
  observe:           fileBackedWorkflow("observe",          "Triage logs, metrics, or alerts into a structured incident/health report"),
  "agent-debug":      fileBackedWorkflow("agent-debug",       "Diagnose LangGraph state machine failures: map graph structure, trace failure, identify root cause"),
  "pr-review":        fileBackedWorkflow("pr-review",         "Structured PR audit: correctness, LangGraph invariants, security, test coverage, logging"),
  "screenshot-audit": fileBackedWorkflow("screenshot-audit",  "Classify visual regression screenshots: regressions vs. intentional changes vs. false positives"),
  "rag-audit":        fileBackedWorkflow("rag-audit",         "Audit RAG pipeline: persistence, chunking, retriever config, seeding, migration path"),
  "extension-audit":  fileBackedWorkflow("extension-audit",   "Browser extension audit: bundle size, permissions, CSP, prompt injection from DOM, message passing security"),
  "scaffold-app":     fileBackedWorkflow("scaffold-app",      "Scaffold a new application from a canonical template (langgraph-app, browser-extension, python-scraper)"),
  "daily-logger":     fileBackedWorkflow("daily-logger",      "Daily-logger architecture briefing: 4-phase pipeline, council-of-experts pattern, persona format, invariants"),
  "skill-loader":     fileBackedWorkflow("skill-loader",      "Skill catalog manager: examine a repo and produce an install plan for which OJF skills to add, keep, or remove"),
  "council-review":   fileBackedWorkflow("council-review",    "Multi-persona expert council review of any draft doc: each persona critiques independently, then synthesizes final version"),
};

export const workflows: WorkflowRegistry = {
  // Programmatic workflows with custom TypeScript handlers
  techdebt: techDebtWorkflow,
  summarize: summarizeWorkflow,
  workbench: workbenchWorkflow,
  // File-backed workflows
  ...fileBacked,
};
