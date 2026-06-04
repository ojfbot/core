// judge.mjs — C2, the scoped LLM stage of the loading-discipline gate (ADR-0081 §Slice 2).
//
// Only runs when the tripwire trips. Judges whether the ADDED content to an always-loaded
// CLAUDE.md is actually *conditional* (belongs in Layer 1/2). Returns a structured verdict, or
// null if it can't decide (no key / error / unparseable) — in which case the gate NEVER blocks.
// The LLM caller is injectable so the logic is unit-testable offline.

export const JUDGE_MODEL = 'claude-haiku-4-5-20251001'; // cheap + scoped, per SPEC.md

const SYSTEM = `You enforce the CLAUDE.md loading-discipline (ADR-0081). The always-loaded layer (a repo-root CLAUDE.md) must hold ONLY content needed in EVERY session regardless of which file is edited (Layer 0). Content that is needed only when editing a specific subtree (Layer 1: nested CLAUDE.md or a path-scoped rule) or only when a specific task/skill runs (Layer 2: a domain-knowledge/docs reference) does NOT belong in the always-loaded layer.

You are shown a block being ADDED to an always-loaded CLAUDE.md. Decide if it is conditional (L1/L2) and therefore misplaced, or genuinely always-needed (L0). Be conservative toward L0: a true safety/always invariant wrongly evicted is a silent failure. Only flag content that clearly only matters in a specific subtree or task.

Respond with ONLY a JSON object, no prose:
{"isConditional": boolean, "suggestedLayer": "L0"|"L1"|"L2", "confidence": number (0..1), "reasoning": "one sentence"}`;

export function buildPrompt({ filePath, addedContent }) {
  const user = `File (always-loaded): ${filePath}\n\nAdded block:\n"""\n${addedContent}\n"""\n\nIs this conditional (misplaced in the always-loaded layer)?`;
  return { system: SYSTEM, user };
}

// Tolerant JSON extraction (Haiku may wrap in a code fence or add stray text).
export function parseVerdict(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let v;
  try { v = JSON.parse(m[0]); } catch { return null; }
  if (typeof v.isConditional !== 'boolean') return null;
  return {
    isConditional: v.isConditional,
    suggestedLayer: ['L0', 'L1', 'L2'].includes(v.suggestedLayer) ? v.suggestedLayer : (v.isConditional ? 'L1' : 'L0'),
    confidence: typeof v.confidence === 'number' ? Math.max(0, Math.min(1, v.confidence)) : null,
    reasoning: typeof v.reasoning === 'string' ? v.reasoning.slice(0, 300) : '',
  };
}

// Default LLM caller — lazy-imports the Anthropic SDK so importing this module never requires it.
async function defaultComplete(system, user) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('no ANTHROPIC_API_KEY');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create(
    { model: JUDGE_MODEL, max_tokens: 256, system, messages: [{ role: 'user', content: user }] },
    { timeout: 20_000 },
  );
  const block = resp.content?.[0];
  return block && block.type === 'text' ? block.text : '';
}

// Returns a verdict object, or null on any failure (→ gate degrades to never-block).
export async function judgeBlock({ filePath, addedContent, complete = defaultComplete }) {
  try {
    const { system, user } = buildPrompt({ filePath, addedContent });
    const text = await complete(system, user);
    return parseVerdict(text);
  } catch {
    return null;
  }
}
