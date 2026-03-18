/**
 * formula-parser — A4 adoption: parse TOML formula files into Formula objects.
 *
 * Usage:
 *   const formula = await parseTOMLFormula('./formulas/blog-publish.toml');
 *   const formula = parseFormulaFromString(tomlSource, 'blog-publish');
 */

import fs from 'fs/promises';
import { parse as parseToml } from 'smol-toml';
import type { Formula, FormulaStep, FormulaVar, FormulaType } from './types/molecule.js';

/**
 * Parse a TOML formula file from disk.
 *
 * @param filePath  Absolute or relative path to the .toml formula file
 * @throws if the file cannot be read or the content is not a valid formula
 */
export async function parseTOMLFormula(filePath: string): Promise<Formula> {
  const source = await fs.readFile(filePath, 'utf-8');
  return parseFormulaFromString(source, filePath);
}

/**
 * Parse a TOML formula from a string.
 * Useful for testing without touching the filesystem.
 *
 * @param source   TOML source string
 * @param label    Human-readable label for error messages (e.g. file path)
 */
export function parseFormulaFromString(source: string, label = '<string>'): Formula {
  let raw: Record<string, unknown>;
  try {
    raw = parseToml(source) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to parse TOML formula "${label}": ${String(err)}`);
  }
  return validateFormula(raw, label);
}

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_TYPES = new Set<string>(['workflow', 'expansion', 'aspect', 'patrol']);

function validateFormula(raw: Record<string, unknown>, label: string): Formula {
  if (typeof raw['formula'] !== 'string' || !raw['formula']) {
    throw new Error(`Formula "${label}": missing required string field "formula"`);
  }
  if (typeof raw['type'] !== 'string' || !VALID_TYPES.has(raw['type'])) {
    throw new Error(
      `Formula "${label}": "type" must be one of: ${[...VALID_TYPES].join(', ')}`
    );
  }
  if (typeof raw['version'] !== 'number') {
    throw new Error(`Formula "${label}": "version" must be a number`);
  }
  if (!Array.isArray(raw['steps']) || raw['steps'].length === 0) {
    throw new Error(`Formula "${label}": "steps" must be a non-empty array`);
  }

  const steps = raw['steps'].map((s: unknown, i: number) =>
    validateStep(s, `${label}.steps[${i}]`)
  );

  validateStepGraph(steps, label);

  const vars: Record<string, FormulaVar> = {};
  if (raw['vars'] && typeof raw['vars'] === 'object' && !Array.isArray(raw['vars'])) {
    for (const [k, v] of Object.entries(raw['vars'] as Record<string, unknown>)) {
      vars[k] = validateVar(v, `${label}.vars.${k}`);
    }
  }

  return {
    formula: raw['formula'] as string,
    type: raw['type'] as FormulaType,
    version: raw['version'] as number,
    description: typeof raw['description'] === 'string' ? raw['description'] : undefined,
    vars: Object.keys(vars).length > 0 ? vars : undefined,
    steps,
  };
}

function validateStep(raw: unknown, label: string): FormulaStep {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Formula step "${label}": must be an object`);
  }
  const s = raw as Record<string, unknown>;
  if (typeof s['id'] !== 'string' || !s['id']) {
    throw new Error(`Formula step "${label}": missing required string field "id"`);
  }
  if (typeof s['title'] !== 'string' || !s['title']) {
    throw new Error(`Formula step "${label}": missing required string field "title"`);
  }

  const needs = Array.isArray(s['needs'])
    ? s['needs'].map((n: unknown, i: number) => {
        if (typeof n !== 'string') throw new Error(`${label}.needs[${i}]: must be a string`);
        return n;
      })
    : [];

  const acceptance_criteria = Array.isArray(s['acceptance_criteria'])
    ? s['acceptance_criteria'].map((c: unknown, i: number) => {
        if (typeof c !== 'string') throw new Error(`${label}.acceptance_criteria[${i}]: must be a string`);
        return c;
      })
    : [];

  return {
    id: s['id'] as string,
    title: s['title'] as string,
    needs,
    acceptance_criteria: acceptance_criteria.length > 0 ? acceptance_criteria : undefined,
    parallel: typeof s['parallel'] === 'boolean' ? s['parallel'] : undefined,
  };
}

function validateVar(raw: unknown, label: string): FormulaVar {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Formula var "${label}": must be an object`);
  }
  const v = raw as Record<string, unknown>;
  if (typeof v['description'] !== 'string') {
    throw new Error(`Formula var "${label}": missing required string field "description"`);
  }
  return {
    description: v['description'] as string,
    required: typeof v['required'] === 'boolean' ? v['required'] : undefined,
    default: typeof v['default'] === 'string' ? v['default'] : undefined,
  };
}

/** Ensure no duplicate step IDs and all `needs` references exist */
function validateStepGraph(steps: FormulaStep[], label: string): void {
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) {
      throw new Error(`Formula "${label}": duplicate step id "${step.id}"`);
    }
    ids.add(step.id);
  }
  for (const step of steps) {
    for (const dep of step.needs) {
      if (!ids.has(dep)) {
        throw new Error(
          `Formula "${label}": step "${step.id}" has unknown dependency "${dep}"`
        );
      }
    }
  }
}
