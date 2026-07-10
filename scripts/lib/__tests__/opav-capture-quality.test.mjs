import { describe, it, expect } from 'vitest';
import { detectUse, detectMaintenance, classify } from '../../opav-capture-quality.mjs';

const read = (fp, skill = '', session_id = 's') => ({ ts: 't', tool_name: 'Read', file_path: fp, skill, session_id });

describe('opav-capture-quality detectors (S22a)', () => {
  it('detects all three execution paths', () => {
    expect(detectUse(read('/x/.claude/skills/vault/SKILL.md'))).toEqual({ skill: 'vault', path: 'inline-read' });
    expect(detectUse({ tool_name: 'Read', file_path: '', skill: 'tdd' })).toEqual({ skill: 'tdd', path: 'inline-read' });
    expect(detectUse({ tool_name: 'Skill', skill: 'adr' })).toEqual({ skill: 'adr', path: 'skill-tool' });
    expect(detectUse({ tool_name: 'Bash', input_summary: '"bash .claude/skills/workbench/scripts/up.sh"' }))
      .toEqual({ skill: 'workbench', path: 'script-exec' });
  });

  it('does not detect non-skill activity', () => {
    expect(detectUse(read('/x/scripts/day-runner.mjs'))).toBeNull();
    expect(detectUse({ tool_name: 'Bash', input_summary: '"git status"' })).toBeNull();
  });

  it('flags mutations under a skill directory as maintenance', () => {
    expect(detectMaintenance({ tool_name: 'Edit', file_path: '/x/.claude/skills/sweep/SKILL.md' })).toBe('sweep');
    expect(detectMaintenance({ tool_name: 'Read', file_path: '/x/.claude/skills/sweep/SKILL.md' })).toBeNull();
    expect(detectMaintenance({ tool_name: 'Edit', file_path: '/x/src/app.ts' })).toBeNull();
  });

  it('classify excludes reads only in sessions that also mutate that skill', () => {
    const rows = [
      read('/x/.claude/skills/sweep/SKILL.md', 'sweep', 'maint'),
      { ts: 't', tool_name: 'Edit', file_path: '/x/.claude/skills/sweep/SKILL.md', skill: '', session_id: 'maint' },
      read('/x/.claude/skills/sweep/SKILL.md', 'sweep', 'clean'),
    ];
    const r = classify(rows);
    expect(r.excludedAsMaintenance).toHaveLength(1);
    expect(r.excludedAsMaintenance[0].session_id).toBe('maint');
    expect(r.use).toHaveLength(1);
    expect(r.use[0].session_id).toBe('clean');
  });
});
