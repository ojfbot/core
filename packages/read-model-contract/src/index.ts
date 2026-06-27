/**
 * @core/read-model-contract — the canonical read-model SDL (ADR-0013).
 *
 * The fleet-wide GraphQL contract that serves the morning-cockpit human UI and agent readers
 * identically. Query-only (no mutations — the sole write path stays Handoff Emission, ADR-0005).
 * Workspace-internal: never published, never imported at runtime by the cockpit — consumed via a
 * CI git-clone of core that vendors `schema.graphql` (ADR-0013, ADR-0001 extended).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSchema, type GraphQLSchema } from 'graphql';

/** Absolute path to the canonical SDL file (package root). */
export const schemaPath = fileURLToPath(new URL('../schema.graphql', import.meta.url));

/** The canonical read-model SDL as a string. */
export const readModelSDL: string = readFileSync(schemaPath, 'utf8');

/** Build the read-model SDL into an executable-typeless `GraphQLSchema` (throws on invalid SDL). */
export function buildReadModelSchema(): GraphQLSchema {
  return buildSchema(readModelSDL);
}
