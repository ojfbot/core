import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefects, sweep } from '../../defects-lint.mjs';

/** Build a minimal core with a defect ledger. */
function scaffold() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'defects-lint-'));
  const core = path.join(tmp, 'core');
  mkdirSync(path.join(core, 'decisions', 'defects'), { recursive: true });
  return { tmp, core };
}

const BASE = {
  type: 'defect-report',
  class: 'false-assertion',
  severity: 'high',
  status: 'open',
  disposition: 'repair-doc',
  location: '"selfco:wiki/x.md:1"',
  claim: '"a false thing"',
  filed: '2026-07-29',
};

function writeDefect(core, slug, over = {}) {
  const fm = { ...BASE, slug, ...over };
  const lines = ['---', ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`), '---', '', '# body', ''];
  writeFileSync(path.join(core, 'decisions', 'defects', `dr-${slug}.md`), lines.join('\n'));
}

describe('defects-lint', () => {
  let env;
  beforeEach(() => { env = scaffold(); });
  afterEach(() => rmSync(env.tmp, { recursive: true, force: true }));

  describe('schema validation', () => {
    it('accepts a well-formed report', () => {
      writeDefect(env.core, 'good', { claim_probe: '"true"' });
      const { defects, errors } = loadDefects(env.core);
      expect(errors).toEqual([]);
      expect(defects).toHaveLength(1);
      expect(defects[0].slug).toBe('good');
    });

    it('rejects a slug that does not match its filename — the identity invariant (ADR-0087)', () => {
      writeDefect(env.core, 'on-disk', { slug: 'in-frontmatter', claim_probe: '"true"' });
      const { errors } = loadDefects(env.core);
      expect(errors.join()).toMatch(/slug 'in-frontmatter' does not match filename/);
    });

    it.each([
      ['class', 'bug'],
      ['severity', 'critical'],
      ['status', 'wontfix'],
      ['disposition', 'ignore'],
    ])('rejects an out-of-enum %s', (field, bad) => {
      writeDefect(env.core, 'x', { [field]: bad, claim_probe: '"true"' });
      const { errors } = loadDefects(env.core);
      expect(errors.join()).toMatch(new RegExp(`invalid ${field} '${bad}'`));
    });

    it('rejects a report with no claim_probe unless it is an explicit stub', () => {
      writeDefect(env.core, 'unverifiable');
      expect(loadDefects(env.core).errors.join()).toMatch(/no claim_probe.*unverifiable/);
    });

    it('allows a probeless report when disposition is needs-investigation', () => {
      writeDefect(env.core, 'stub', { disposition: 'needs-investigation' });
      expect(loadDefects(env.core).errors).toEqual([]);
    });

    it('reports missing required fields', () => {
      writeFileSync(
        path.join(env.core, 'decisions', 'defects', 'dr-bare.md'),
        '---\ntype: defect-report\nslug: bare\n---\n',
      );
      const errors = loadDefects(env.core).errors.join();
      for (const k of ['class', 'severity', 'status', 'disposition', 'location', 'claim', 'filed']) {
        expect(errors).toMatch(new RegExp(`missing '${k}'`));
      }
    });
  });

  describe('sweep', () => {
    it('classifies claim_probe exit 0 as still-broken', () => {
      writeDefect(env.core, 'present', { claim_probe: '"true"' });
      const { defects } = loadDefects(env.core);
      expect(sweep(defects, env.core)[0].verdict).toBe('still-broken');
    });

    it('classifies claim_probe non-zero as claim-gone', () => {
      writeDefect(env.core, 'repaired', { claim_probe: '"false"' });
      const { defects } = loadDefects(env.core);
      expect(sweep(defects, env.core)[0].verdict).toBe('claim-gone');
    });

    it('captures truth_probe output as evidence', () => {
      writeDefect(env.core, 'withtruth', { claim_probe: '"true"', truth_probe: '"echo 668"' });
      const { defects } = loadDefects(env.core);
      expect(sweep(defects, env.core)[0].truth).toBe('668');
    });

    it('surfaces a BROKEN truth_probe instead of rendering it blank', () => {
      // A dead probe that reads as an empty line is the silent-failure class this
      // ledger exists to catch; it must be loud.
      writeDefect(env.core, 'brokentruth', {
        claim_probe: '"true"',
        truth_probe: '"exit 3"',
      });
      const { defects } = loadDefects(env.core);
      const [row] = sweep(defects, env.core);
      expect(row.truthOk).toBe(false);
      expect(row.truth).toMatch(/PROBE EXIT 3/);
    });

    it('flags a truth_probe that exits 0 with no output', () => {
      writeDefect(env.core, 'emptytruth', { claim_probe: '"true"', truth_probe: '"true"' });
      const { defects } = loadDefects(env.core);
      const [row] = sweep(defects, env.core);
      expect(row.truthOk).toBe(false);
      expect(row.truth).toMatch(/PROBE EMPTY/);
    });

    it('skips terminal statuses', () => {
      writeDefect(env.core, 'done', { status: 'verified-closed', claim_probe: '"true"' });
      writeDefect(env.core, 'moot', { status: 'unreproducible', claim_probe: '"true"' });
      const { defects } = loadDefects(env.core);
      expect(sweep(defects, env.core)).toHaveLength(0);
    });

    it('probes needs-confirmation reports (a verifier needs the data)', () => {
      writeDefect(env.core, 'unconfirmed', { status: 'needs-confirmation', claim_probe: '"false"' });
      const { defects } = loadDefects(env.core);
      const rows = sweep(defects, env.core);
      expect(rows).toHaveLength(1);
      expect(rows[0].verdict).toBe('claim-gone');
    });

    it('marks a probeless stub no-probe rather than closing it', () => {
      writeDefect(env.core, 'stub', { disposition: 'needs-investigation' });
      const { defects } = loadDefects(env.core);
      expect(sweep(defects, env.core)[0].verdict).toBe('no-probe');
    });
  });

  it('returns an error when the ledger directory is absent', () => {
    const bare = mkdtempSync(path.join(os.tmpdir(), 'defects-none-'));
    expect(loadDefects(bare).errors.join()).toMatch(/ledger directory missing/);
    rmSync(bare, { recursive: true, force: true });
  });
});
