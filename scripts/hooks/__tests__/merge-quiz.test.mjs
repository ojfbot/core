// merge-quiz.test.mjs — H8 Stage A, adr:harness-loop-instrumentation.
//
// Stage A is observe-only. The tests that matter most here are the NEGATIVE ones: a
// detector that over-matches floods the ledger and makes the Stage A verdict meaningless,
// and a detector that blocks violates ADR-0086's shadow-first requirement outright.

import { describe, it, expect } from 'vitest';
import { classifyMergeCommand, wouldQuiz, stageAVerdict, comprehensionByCell, QUIZ_THRESHOLD_LINES } from '../merge-quiz.mjs';

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

  it('does not fire below the threshold', () => {
    expect(wouldQuiz(QUIZ_THRESHOLD_LINES - 1)).toBe(false);
    expect(wouldQuiz(0)).toBe(false);
  });

  it('returns NULL, not false, when the size is undeterminable', () => {
    // Regression (found by the /merge-quiz fresh-context pass on PR #295): returning `false`
    // let unmeasurable merges pad the `merges` denominator while never reaching `wouldHave`,
    // so every one of them pushed the verdict toward `retire` on no evidence at all.
    expect(wouldQuiz(null)).toBeNull();
    expect(wouldQuiz(undefined)).toBeNull();
    expect(wouldQuiz(NaN)).toBeNull();
  });
});

describe('stageAVerdict — the promote/retire decision, made on evidence', () => {
  const merge = (would_quiz) => ({ event: 'harness:merge-observed', would_quiz });

  it('EXCLUDES unknown-size rows from the sample entirely', () => {
    const records = [...Array.from({ length: 20 }, () => merge(null)), merge(true), merge(false)];
    const v = stageAVerdict(records, { minMerges: 20 });
    expect(v.merges).toBe(2); // not 22
    expect(v.unknown).toBe(20);
    expect(v.verdict).toBe('keep-observing'); // must NOT reach `retire` on unmeasurable rows
  });

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

  it('does not count quiz rows as merges — the two faces of the harness share a ledger', () => {
    const records = [...Array.from({ length: 5 }, () => merge(true)), { event: 'harness:quiz-taken', score: 100 }];
    expect(stageAVerdict(records, { minMerges: 20 }).merges).toBe(5);
  });
});

describe('comprehensionByCell — the decay heatmap', () => {
  const quiz = (repo, domain, score) => ({ event: 'harness:quiz-taken', repo, domain, score });

  it('weights recent quizzes more heavily than old ones (EWMA, not a flat mean)', () => {
    // A repo understood well six months ago says nothing about what landed last week.
    const out = comprehensionByCell([quiz('core', 'tracking', 60), quiz('core', 'tracking', 100)], { alpha: 0.4 });
    expect(out[0].ewma).toBeCloseTo(76, 5); // 0.4*100 + 0.6*60 — flat mean would be 80
    expect(out[0].n).toBe(2);
    expect(out[0].last).toBe(100);
  });

  it('sorts worst-first — the top row is where to re-engage', () => {
    const out = comprehensionByCell([quiz('a', 'x', 90), quiz('b', 'y', 30), quiz('c', 'z', 60)]);
    expect(out.map((c) => c.repo)).toEqual(['b', 'c', 'a']);
  });

  it('keys by repo AND domain, so one strong subsystem cannot mask a weak sibling', () => {
    const out = comprehensionByCell([quiz('core', 'tracking', 100), quiz('core', 'hooks', 20)]);
    expect(out).toHaveLength(2);
    expect(out[0].domain).toBe('hooks');
  });

  it('ignores merge-observation rows and unscored rows', () => {
    const records = [{ event: 'harness:merge-observed', would_quiz: true }, { event: 'harness:quiz-taken' }, quiz('a', 'x', 50)];
    expect(comprehensionByCell(records)).toHaveLength(1);
  });

  it('returns [] when no quiz has ever been taken — never a fabricated baseline', () => {
    expect(comprehensionByCell([{ event: 'harness:merge-observed' }])).toEqual([]);
  });

  it('keeps TAUGHT and COLD scores in separate cells — they answer different questions', () => {
    // Briefing the change before quizzing reliably raises the score. If the two modes shared
    // a cell, a run of taught quizzes would pull the average up and mask real decay in the
    // exact subsystem the heatmap exists to surface.
    const records = [
      { event: 'harness:quiz-taken', repo: 'core', domain: 'tracking', mode: 'taught', score: 90 },
      { event: 'harness:quiz-taken', repo: 'core', domain: 'tracking', mode: 'cold', score: 40 },
    ];
    const out = comprehensionByCell(records);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.mode)).toEqual(['cold', 'taught']); // worst-first
    expect(out.find((c) => c.mode === 'cold').ewma).toBe(40);
    expect(out.find((c) => c.mode === 'taught').ewma).toBe(90);
  });

  it('reads an unlabelled legacy row as taught — the conservative default', () => {
    // Reading an unknown score as `cold` would overstate demonstrated prior understanding.
    const out = comprehensionByCell([{ event: 'harness:quiz-taken', repo: 'a', domain: 'x', score: 70 }]);
    expect(out[0].mode).toBe('taught');
  });
});
