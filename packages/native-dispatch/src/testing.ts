/**
 * TEST ONLY: `@core/native-dispatch/testing`. Production code imports the main entry, which does
 * not export these. A test replaces the correspondence allowlist with fixture entries and restores
 * the shipped one afterwards.
 */
export { replaceCorrespondenceAllowlistForTesting } from "./correspondence-qualification.js";
export type { QualifiedClaudeCorrespondence } from "./correspondence-allowlist.js";
