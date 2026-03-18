/**
 * Molecule types — A4 adoption.
 *
 * A Formula is a TOML workflow definition. Compiled → MoleculeGraph (IR).
 * Sub-apps realize the MoleculeGraph using their own LangGraph instance.
 *
 * Runtime state (which steps have completed) lives in a FrameMolecule bead
 * in the BeadStore, not in memory. Crash recovery reads the bead on restart.
 *
 * Gas Town mapping:
 *   Formula         → TOML template (same concept)
 *   Molecule        → instantiated formula with runtime state
 *   Protomolecule   → formula snapshot at pour time (stored in FrameMolecule.labels.formula_snapshot)
 *   checkpointNode  → checkpointMoleculeStep() call at each LangGraph node exit
 */

import type { FrameBead } from './bead.js';

// ── Formula (TOML definition) ────────────────────────────────────────────────

export type FormulaType = 'workflow' | 'expansion' | 'aspect' | 'patrol';

export interface FormulaVar {
  description: string;
  required?: boolean;
  default?: string;
}

export interface FormulaStep {
  id: string;
  title: string;
  /** IDs of steps that must complete before this step can run */
  needs: string[];
  acceptance_criteria?: string[];
  /** If true: step is run as a LangGraph parallel branch */
  parallel?: boolean;
}

export interface Formula {
  formula: string;
  type: FormulaType;
  version: number;
  description?: string;
  vars?: Record<string, FormulaVar>;
  steps: FormulaStep[];
}

// ── MoleculeGraph (compiled IR) ──────────────────────────────────────────────

/**
 * A node in the compiled molecule graph.
 * Sub-apps map each node to a LangGraph node by `stepId`.
 */
export interface MoleculeNode {
  stepId: string;
  title: string;
  acceptance_criteria: string[];
  /** Step IDs that must complete before this node runs */
  needs: string[];
  /** Step IDs this node unblocks when complete */
  unblocks: string[];
}

/**
 * The compiled intermediate representation of a Formula.
 *
 * Sub-apps realize this with LangGraph:
 *   const graph = new StateGraph(...);
 *   for (const node of moleculeGraph.nodes) {
 *     graph.addNode(node.stepId, myNodeFn(node));
 *   }
 *   for (const [from, to] of moleculeGraph.edges) {
 *     graph.addEdge(from, to);
 *   }
 *   graph.setEntryPoint(moleculeGraph.entrySteps[0]); // or handle parallel entries
 */
export interface MoleculeGraph {
  formulaName: string;
  formulaType: FormulaType;
  /** Steps with no dependencies — LangGraph entry points */
  entrySteps: string[];
  /** Steps with no successors — LangGraph terminal nodes */
  terminalSteps: string[];
  nodes: MoleculeNode[];
  /** Directed edges [fromStepId, toStepId] — derived from step.needs */
  edges: [string, string][];
}

// ── FrameMolecule (runtime bead) ─────────────────────────────────────────────

/**
 * FrameMolecule extends FrameBead (type: 'molecule') to hold runtime state.
 *
 * Checkpoint labels:
 *   labels.formula         — formula name (e.g. "blog-publish")
 *   labels.step_<id>       — 'done' | 'skipped' | 'error' for each completed step
 *   labels.vars_<name>     — resolved variable values at pour time
 *
 * Crash recovery: on restart, read all labels matching /^step_/,
 * then ask compileMoleculeToGraph which steps are still pending.
 */
export interface FrameMolecule extends FrameBead {
  type: 'molecule';
  labels: FrameBead['labels'] & {
    formula: string;
    [stepKey: `step_${string}`]: 'done' | 'skipped' | 'error';
    [varKey: `vars_${string}`]: string;
  };
}

/** Type guard */
export function isFrameMolecule(bead: FrameBead): bead is FrameMolecule {
  return bead.type === 'molecule' && typeof bead.labels['formula'] === 'string';
}

/** Completed step IDs extracted from a molecule bead's labels */
export function completedSteps(molecule: FrameMolecule): string[] {
  return Object.entries(molecule.labels)
    .filter(([k, v]) => k.startsWith('step_') && v === 'done')
    .map(([k]) => k.slice('step_'.length));
}
