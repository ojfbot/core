// Shared commitlint rules for every fleet repo (adr:deterministic-fleet-versioning).
//
// Deliberately self-contained: no `extends`, no plugins, no imports. The reusable CI workflow
// runs this file with a bare `commitlint` CLI, so it must not depend on anything installed in
// the calling repo. Do not add a dependency here without changing that workflow.
//
// Types follow Conventional Commits. release-please turns them into versions:
//   fix -> patch, feat -> minor, `!` or a BREAKING CHANGE footer -> major
// (below 1.0 the bump is lowered; see release-please-config.json). Every other type is allowed
// but never releases by itself.
export const types = [
  'feat',
  'fix',
  'perf',
  'revert',
  'docs',
  'style',
  'refactor',
  'test',
  'build',
  'ci',
  'chore',
];

// The scope names the package or area a commit touches, for the reader. It is optional and it
// is NOT an enumerated list: a fixed list per repo goes stale each time a package is added, and
// release-please attributes a commit to a package by the files it changes, not by its scope.
// What stays deterministic is the shape, so the same spelling works in every repo.
export const scopePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A plugin rule, because commitlint's own scope-case also accepts several scopes in one header
// and treats "/" and "," as separators. A single kebab-case word per scope is the fleet rule.
const plugin = {
  rules: {
    'fleet-scope-shape': ({ scope }) => {
      if (!scope) return [true];
      const parts = scope.split(/[,/\\]/).map((s) => s.trim());
      const bad = parts.find((s) => !scopePattern.test(s));
      return [
        bad === undefined,
        bad === undefined
          ? ''
          : `scope "${bad}" must be lowercase kebab-case (letters, digits, single hyphens), e.g. fleet-runner`,
      ];
    },
  },
};

// The default parser does not understand the Conventional Commits `!` breaking marker
// ("feat(scope)!: ..."), and a breaking change must be writable: it is what makes a major
// release. The inline pattern keeps this file free of the conventionalcommits parser package.
const parserPreset = {
  parserOpts: {
    headerPattern: /^(\w*)(?:\(([^)]+)\))?!?: (.*)$/,
    headerCorrespondence: ['type', 'scope', 'subject'],
    breakingHeaderPattern: /^(\w*)(?:\(([^)]+)\))?!: (.*)$/,
    noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
  },
};

export default {
  parserPreset,
  plugins: [plugin],
  // Squash-merge bodies and release-please PR bodies carry long lines and URLs, so the body and
  // footer line limits are off. The header limit stays: it becomes the changelog line.
  rules: {
    'type-enum': [2, 'always', types],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'kebab-case'],
    'fleet-scope-shape': [2, 'always'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'header-trim': [2, 'always'],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
