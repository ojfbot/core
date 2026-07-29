// deviation-log.test.mjs — H6, adr:harness-loop-instrumentation.
//
// The detector is INDEPENDENT: it parses implementation-notes.md itself rather than
// trusting any count the agent asserts. These tests pin the parse, the repo-scoped
// identity (which is what makes cross-repo recurrence countable), and the recurrence
// rollup that generates the ADR backlog.

import { describe, it, expect } from 'vitest';
import { parseDeviations, deviationKey, newDeviations, recurrenceReport } from '../deviation-log.mjs';

describe('parseDeviations — reads the territory, not the agent’s summary', () => {
  it('extracts one entry per top-level list item under ## Deviations', () => {
    const md = [
      '# Implementation notes',
      '',
      '## Plan',
      '- do the thing',
      '',
      '## Deviations',
      '- Auth middleware ordering forced the guard before the parser.',
      '- Vendor API returns 200 on failure; added an explicit body check.',
    ].join('\n');
    expect(parseDeviations(md)).toEqual([
      'Auth middleware ordering forced the guard before the parser.',
      'Vendor API returns 200 on failure; added an explicit body check.',
    ]);
  });

  it('folds continuation lines so a wrapped deviation stays ONE deviation', () => {
    const md = ['## Deviations', '- The migration could not run online because', '  the table lacks a covering index.'].join('\n');
    expect(parseDeviations(md)).toEqual(['The migration could not run online because the table lacks a covering index.']);
  });

  it('stops at the next same-or-shallower heading, so later sections never leak in', () => {
    const md = ['## Deviations', '- real deviation', '', '## Open items', '- not a deviation'].join('\n');
    expect(parseDeviations(md)).toEqual(['real deviation']);
  });

  it('a deeper HEADING does not close the section — its items still belong to Deviations', () => {
    const md = ['## Deviations', '- parent entry', '', '### Sub detail', '- swallowed by the subsection'].join('\n');
    expect(parseDeviations(md)).toEqual(['parent entry', 'swallowed by the subsection']);
  });

  it('folds indented SUB-BULLETS into their parent — one deviation, not three', () => {
    // Regression, found by the /merge-quiz fresh-context pass on PR #295. `^\s*` on the item
    // regex matched indented bullets as fresh entries, so a parent with two detail lines
    // recorded as 3 deviations: it inflated the discovery count AND fragmented the recurrence
    // groups, which silently empties the ADR backlog the whole edge depends on.
    const md = ['## Deviations', '- parent deviation', '  - detail one', '  - detail two'].join('\n');
    expect(parseDeviations(md)).toEqual(['parent deviation detail one detail two']);
  });

  it('folds sub-bullets nested more than one level deep', () => {
    const md = ['## Deviations', '- parent', '  - child', '    - grandchild', '- sibling'].join('\n');
    expect(parseDeviations(md)).toEqual(['parent child grandchild', 'sibling']);
  });

  it('treats a uniformly-indented section as top-level entries, not as one folded blob', () => {
    // The baseline is the FIRST item's indent, so a section written entirely at one indent
    // still yields separate deviations.
    expect(parseDeviations(['## Deviations', '  - a', '  - b'].join('\n'))).toEqual(['a', 'b']);
  });

  it('self-corrects when a later item is shallower than the first', () => {
    expect(parseDeviations(['## Deviations', '  - a', '- b'].join('\n'))).toEqual(['a', 'b']);
  });

  it('folds a sub-bullet that follows a blank line', () => {
    const md = ['## Deviations', '- parent', '', '  - detail after a blank line'].join('\n');
    expect(parseDeviations(md)).toEqual(['parent detail after a blank line']);
  });

  it('returns [] for notes with no Deviations section, and for empty input', () => {
    expect(parseDeviations('# Notes\n\n## Plan\n- a\n')).toEqual([]);
    expect(parseDeviations('')).toEqual([]);
    expect(parseDeviations(undefined)).toEqual([]);
  });

  it('accepts numbered lists and alternate bullet markers', () => {
    const md = ['## Deviations', '1. first', '* second', '+ third'].join('\n');
    expect(parseDeviations(md)).toEqual(['first', 'second', 'third']);
  });

  it('matches the heading case-insensitively at any depth', () => {
    expect(parseDeviations('### deviations\n- x')).toEqual(['x']);
  });
});

describe('deviationKey — repo-scoped ON PURPOSE', () => {
  it('is stable across whitespace and case differences', () => {
    expect(deviationKey('core', 'The  Same   Thing')).toBe(deviationKey('core', 'the same thing'));
  });

  it('DIFFERS across repos for identical text — cross-repo recurrence is the signal, not noise', () => {
    // If this ever collapses to a single key, the "same deviation in 3 repos = missing
    // convention" edge silently stops working and the ADR backlog goes empty.
    expect(deviationKey('core', 'same text')).not.toBe(deviationKey('cv-builder', 'same text'));
  });
});

describe('newDeviations — idempotent across repeated Stop-hook fires', () => {
  const entries = ['alpha', 'beta'];

  it('returns everything on a first pass', () => {
    expect(newDeviations({ repo: 'core', entries, recorded: new Set() }).map((d) => d.text)).toEqual(['alpha', 'beta']);
  });

  it('returns nothing on a second pass — a standing notes file must not re-emit every session', () => {
    const recorded = new Set(entries.map((t) => deviationKey('core', t)));
    expect(newDeviations({ repo: 'core', entries, recorded })).toEqual([]);
  });

  it('returns only the genuinely new entry when the file grows', () => {
    const recorded = new Set([deviationKey('core', 'alpha')]);
    expect(newDeviations({ repo: 'core', entries, recorded }).map((d) => d.text)).toEqual(['beta']);
  });

  it('collapses duplicates within a single file', () => {
    expect(newDeviations({ repo: 'core', entries: ['a', 'a'], recorded: new Set() })).toHaveLength(1);
  });

  it('still emits in a second repo — the same finding elsewhere is a NEW observation', () => {
    const recorded = new Set([deviationKey('core', 'alpha')]);
    expect(newDeviations({ repo: 'shell', entries: ['alpha'], recorded }).map((d) => d.text)).toEqual(['alpha']);
  });
});

describe('recurrenceReport — the auto-generated ADR backlog', () => {
  const rec = (repo, text) => ({ repo, text });

  it('surfaces a deviation seen in >= minRepos distinct repos', () => {
    const records = [rec('core', 'Vendor returns 200 on failure'), rec('shell', 'vendor returns 200 on failure'), rec('cv-builder', 'Vendor  returns 200 on  failure')];
    const out = recurrenceReport(records, { minRepos: 3 });
    expect(out).toHaveLength(1);
    expect(out[0].repoCount).toBe(3);
    expect(out[0].repos).toEqual(['core', 'cv-builder', 'shell']);
  });

  it('does NOT surface an edge case confined to one repo, however often it repeats', () => {
    // Three occurrences in one repo is a repeated edge case, not a missing convention.
    const records = [rec('core', 'x'), rec('core', 'x'), rec('core', 'x')];
    expect(recurrenceReport(records, { minRepos: 3 })).toEqual([]);
  });

  it('ranks by breadth across repos first', () => {
    const records = [rec('a', 'wide'), rec('b', 'wide'), rec('c', 'wide'), rec('a', 'narrow'), rec('b', 'narrow')];
    const out = recurrenceReport(records, { minRepos: 2 });
    expect(out.map((e) => e.text)).toEqual(['wide', 'narrow']);
  });

  it('ignores malformed rows rather than throwing — a torn ledger never kills the report', () => {
    const records = [null, {}, { repo: 'a' }, { text: 'b' }, rec('a', 'ok'), rec('b', 'ok')];
    expect(recurrenceReport(records, { minRepos: 2 }).map((e) => e.text)).toEqual(['ok']);
  });
});
