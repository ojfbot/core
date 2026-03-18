/**
 * molecule-compiler — A4 adoption.
 *
 * compileMoleculeToGraph(formula) → MoleculeGraph (typed IR)
 *
 * The MoleculeGraph describes the DAG of steps. Sub-apps realize it with
 * their own LangGraph instance:
 *
 *   const spec = compileMoleculeToGraph(formula);
 *   const graph = new StateGraph(MoleculeState);
 *   for (const node of spec.nodes) {
 *     graph.addNode(node.stepId, buildNodeFn(node, beadStore, moleculeBeadId));
 *   }
 *   for (const [from, to] of spec.edges) {
 *     graph.addEdge(from, to);
 *   }
 *   graph.setEntryPoint(spec.entrySteps[0]);
 *
 * resumeMolecule(formula, completedStepIds) → string[]
 *   Returns the next runnable step IDs given which steps have already completed.
 *   Used on crash recovery: re-enter the graph at the right nodes.
 *
 * checkpointMoleculeStep(moleculeBeadId, stepId, store)
 *   Writes step completion to the FrameMolecule bead. The graph calls this at
 *   each node exit (before advancing to the next node) — NDI checkpoint.
 */

import type { Formula } from './types/molecule.js';
import type { MoleculeGraph, MoleculeNode } from './types/molecule.js';
import type { BeadStore } from './types/bead.js';

/**
 * Compile a Formula into a MoleculeGraph (intermediate representation).
 *
 * Topological properties computed:
 *   - entrySteps:    steps with needs === []
 *   - terminalSteps: steps nothing else depends on
 *   - edges:         [fromStepId, toStepId] pairs (one per needs relationship)
 *   - unblocks:      reverse of needs — "when I complete, which steps become runnable"
 */
export function compileMoleculeToGraph(formula: Formula): MoleculeGraph {
  const stepIds = new Set(formula.steps.map((s) => s.id));

  // Build reverse-dependency map: stepId → set of step IDs that depend on it
  const unlocksMap = new Map<string, Set<string>>();
  for (const id of stepIds) unlocksMap.set(id, new Set());
  for (const step of formula.steps) {
    for (const dep of step.needs) {
      unlocksMap.get(dep)!.add(step.id);
    }
  }

  const nodes: MoleculeNode[] = formula.steps.map((step) => ({
    stepId: step.id,
    title: step.title,
    acceptance_criteria: step.acceptance_criteria ?? [],
    needs: step.needs,
    unblocks: [...(unlocksMap.get(step.id) ?? [])],
  }));

  const edges: [string, string][] = [];
  for (const step of formula.steps) {
    for (const dep of step.needs) {
      edges.push([dep, step.id]);
    }
  }

  const entrySteps = formula.steps
    .filter((s) => s.needs.length === 0)
    .map((s) => s.id);

  const terminalSteps = nodes
    .filter((n) => n.unblocks.length === 0)
    .map((n) => n.stepId);

  return {
    formulaName: formula.formula,
    formulaType: formula.type,
    entrySteps,
    terminalSteps,
    nodes,
    edges,
  };
}

/**
 * Given a compiled graph and a set of already-completed step IDs, return the
 * next runnable step IDs.
 *
 * A step is runnable when:
 *   1. It has not already completed.
 *   2. All of its `needs` have completed.
 *
 * Used for crash recovery: sub-app calls this to determine which LangGraph
 * nodes to re-enter after reading the molecule bead from BeadStore.
 *
 * @param graph            Compiled MoleculeGraph
 * @param completedStepIds Step IDs already marked 'done' in the molecule bead
 * @returns                Next unblocked, not-yet-completed step IDs
 */
export function resumeMolecule(
  graph: MoleculeGraph,
  completedStepIds: string[],
): string[] {
  const done = new Set(completedStepIds);
  return graph.nodes
    .filter(
      (node) =>
        !done.has(node.stepId) &&
        node.needs.every((dep) => done.has(dep)),
    )
    .map((node) => node.stepId);
}

/**
 * Record a step completion in the molecule bead (NDI checkpoint).
 *
 * Call this at the end of each LangGraph node, before the edge to the next
 * node is traversed. If the process crashes after this write but before the
 * next node runs, the step will not be re-run on restart.
 *
 * @param moleculeBeadId  ID of the FrameMolecule bead in BeadStore
 * @param stepId          ID of the completed step
 * @param store           BeadStore instance
 * @param outcome         'done' (default) | 'skipped' | 'error'
 */
export async function checkpointMoleculeStep(
  moleculeBeadId: string,
  stepId: string,
  store: BeadStore,
  outcome: 'done' | 'skipped' | 'error' = 'done',
): Promise<void> {
  const bead = await store.get(moleculeBeadId);
  if (bead === null) {
    throw new Error(`checkpointMoleculeStep: molecule bead not found: ${moleculeBeadId}`);
  }
  await store.update(moleculeBeadId, {
    labels: {
      ...bead.labels,
      [`step_${stepId}`]: outcome,
    },
  });
}
