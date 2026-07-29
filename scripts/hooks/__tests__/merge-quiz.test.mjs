// merge-quiz.test.mjs — H8 Stage A, adr:harness-loop-instrumentation.
//
// Stage A is observe-only. The tests that matter most here are the NEGATIVE ones: a
// detector that over-matches floods the ledger and makes the Stage A verdict meaningless,
// and a detector that blocks violates ADR-0086's shadow-first requirement outright.

import { describe, it, expect } from 'vitest';
import { classifyMergeCommand, wouldQuiz, stageAVerdict, QUIZ_THRESHOLD_LINES } from '../merge-quiz.mjs';

describe('classifyMergeCommand — narrow on purpose', () => {
  it('matches gh pr merge and captures the PR number', () => {
    expect(classifyMergeCommand('gh pr merge 294 --squash')).toEqual({ isMerge: true, kind: 'gh-pr', pr: '294' });
  });

  it('matches gh pr merge with no explicit PR number', () => {
    expect(classifyMergeCommand('gh pr merge --squash')).toMatchObject({ isMerge: true, kind: 'gh-pr' });
  });

  it('matches a plain git merge', () => {
    expect(classifyMergeCommand('git merge feature/x')).toMatchObject({ isMerge: true, kind: 'git' });
  });

  it('does NOT match --abort / --continue / --quit — those cross no review boundary', () => {
    expect(classifyMergeCommand('git merge --abort').isMerge).toBe(false);
    expect(classifyMergeCommand('git merge --continue').isMerge).toBe(false);
    expect(classifyMergeCommand('git merge --quit').isMerge).toBe(false);
  });

  it('does NOT match near-miss commands that merely mention merging', () => {
    // Over-matching here is the failure mode: every one of these would become a phantom
    // "merge" in the ledger and quietly corrupt the promote/retire decision.
    for (const cmd of [
      'git merge-base HEAD main',
      'git log --merges',
      'gh pr list --search merge',
      'echo "gh pr merge"'.replace('gh pr merge', 'about merging'),
      'git rebase main',
      'gh pr create --title "merge the thing"',
    ]) {
      expect(classifyMergeCommand(cmd).isMerge, cmd).toBe(false);
    }
  });

  it('finds a merge inside a compound command', () => {
    expect(classifyMergeCommand('git fetch && gh pr merge 12 --squash').isMerge).toBe(true);
    expect(classifyMergeCommand('git status; git merge main').isMerge).toBe(true);
  });

  it('is safe on empty / non-string input', () => {
    expect(classifyMergeCommand('').isMerge).toBe(false);
    expect(classifyMergeCommand(undefined).isMerge).toBe(false);
    expect(classifyMergeCommand(null).isMerge).toBe(false);
    expect(classifyMergeCommand(42).isMerge).toBe(false);
  });
});

describe('wouldQuiz', () => {
  it('fires at or above the threshold', () => {
    expect(wouldQuiz(QUIZ_THRESHOLD_LINES)).toBe(true);
    expect(wouldQuiz(QUIZ_THRESHOLD_LINES + 1)).toBe(true);
  });

  it('does not fire below it, and never fires on an unknown size', () => {
    expect(wouldQuiz(QUIZ_THRESHOLD_LINES - 1)).toBe(false);
    expect(wouldQuiz(0)).toBe(false);
    expect(wouldQuiz(null)).toBe(false); // diff size undeterminable → do not invent a gate
  });
});

describe('stageAVerdict — the promote/retire decision, made on evidence', () => {
  const merge = (would_quiz) => ({ event: 'harness:merge-observed', would_quiz });

  it('keeps observing below the minimum sample', () => {
    const v = stageAVerdict([merge(true), merge(false)], { minMerges: 20 });
    expect(v.verdict).toBe('keep-observing');
    expect(v.needed).toBe(18);
  });

  it('RETIRES when the quiz would never have fired — this is the rule working, not failing', () => {
    const v = stageAVerdict(Array.from({ length: 20 }, () => merge(false)), { minMerges: 20 });
    expect(v.verdict).toBe('retire');
  });

  it('becomes a promotion candidate once merges would actually have been gated', () => {
    const records = [...Array.from({ length: 15 }, () => merge(false)), ...Array.from({ length: 5 }, () => merge(true))];
    const v = stageAVerdict(records, { minMerges: 20 });
    expect(v.verdict).toBe('promote-candidate');
    expect(v.wouldHave).toBe(5);
  });

  it('ignores unrelated ledger rows so a shared file cannot inflate the count', () => {
    const records = [...Array.from({ length: 20 }, () => merge(true)), { event: 'harness:deviation' }, {}];
    expect(stageAVerdict(records, { minMerges: 20 }).merges).toBe(20);
  });
});
