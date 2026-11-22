// Shared commitlint rules for every fleet repo (adr:deterministic-fleet-versioning).
//
// Deliberately self-contained: no `extends`, no plugins, no imports. The reusable CI workflow
// runs this file with a bare `commitlint` CLI, so it must not depend on anything installed in
// the calling repo. Do not add a dependency here without changing that workflow.
//
// Types follow Conventional Commits. release-please turns them into versions:
//   feat -> minor; fix, perf and revert -> patch; `!` or a BREAKING CHANGE footer -> major
// (below 1.0 a breaking change bumps the minor; see release-please-config.json). docs, style,
// refactor, test, build, ci and chore are allowed but never release by themselves.
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

// EVERY commit is linted: the conventional-commits default ignores (merge commits, `fixup!`,
// `squash!`, `Revert "..."`, a bare version number) are switched off, so none of those slips through.
// Exactly two merge-commit headers are allowed, because git and GitHub write them and no human
// can add a type to them without breaking "Update branch" and `git merge`:
//   Merge branch '<branch>' into <branch>     (git merge, GitHub "Update branch")
//   Merge pull request #<n> from <owner>/<branch>   (GitHub merge button)
// Anything else must be a conventional header. That means `git commit --fixup` commits are refused
// (squash them with an interactive rebase before committing) and a reverting commit is written
// `revert: <subject>`. Merge commits never release anything: release-please ignores them.
export const mergeHeaders = [
  /^Merge branch '[A-Za-z0-9._/-]+' into [A-Za-z0-9._/-]+$/,
  /^Merge pull request #\d+ from [A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/,
];
// The rest of the message may only be blank lines or `#` comment lines (what git adds for conflicts),
// so a hand-written body cannot ride along unlinted behind a merge header.
const isAllowedMerge = (message) => {
  const [header, ...rest] = String(message).split('\n');
  return mergeHeaders.some((re) => re.test(header)) && rest.every((line) => line.trim() === '' || line.startsWith('#'));
};

export default {
  defaultIgnores: false,
  ignores: [isAllowedMerge],
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
