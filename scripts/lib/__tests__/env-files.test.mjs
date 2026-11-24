import { describe, it, expect } from 'vitest';
import { classifyEnvPath, exampleFindings, scan } from '../env-files.mjs';

const SECRETISH = 'sk-ant-api03-' + 'Q'.repeat(40);

describe('classifyEnvPath', () => {
  it('names env files at any depth and lets only .env.example through', () => {
    expect(classifyEnvPath('.env')).toBe('env');
    expect(classifyEnvPath('packages/fleet-runner/.env')).toBe('env');
    expect(classifyEnvPath('packages/x/.env.local')).toBe('env');
    expect(classifyEnvPath('packages/x/.env.production')).toBe('env');
    expect(classifyEnvPath('packages/x/.env.example')).toBe('example');
    expect(classifyEnvPath('.env.example')).toBe('example');
    expect(classifyEnvPath('packages/x/src/env.ts')).toBe(null);
    expect(classifyEnvPath('docs/.envrc-notes.md')).toBe(null);
    expect(classifyEnvPath('packages/x/environment.md')).toBe(null);
  });
});

describe('exampleFindings', () => {
  it('accepts blank values, <placeholders>, comments and blank lines', () => {
    const text = '# what it is\n\nFLEET_ENDPOINT=\nFLEET_TOKEN_FILE=<path to the token file>\nQUOTED=""\n';
    expect(exampleFindings('p/.env.example', text)).toEqual([]);
  });

  it('warns on an obviously fake value and fails on a real-looking one, never printing the value', () => {
    const warn = exampleFindings('p/.env.example', 'ANTHROPIC_API_KEY=sk-ant-...\n');
    expect(warn).toEqual([{ level: 'WARN', path: 'p/.env.example', message: 'ANTHROPIC_API_KEY has a placeholder-like value; use blank or <placeholder>' }]);
    const error = exampleFindings('p/.env.example', `ANTHROPIC_API_KEY=${SECRETISH}\nPORT=4000\n`);
    expect(error.map(f => [f.level, f.message])).toEqual([
      ['ERROR', 'ANTHROPIC_API_KEY has a real-looking value; an example file holds blanks or <placeholders> only'],
      ['ERROR', 'PORT has a real-looking value; an example file holds blanks or <placeholders> only'],
    ]);
    expect(JSON.stringify(error)).not.toContain(SECRETISH);
  });

  it('flags a line that is not KEY=VALUE', () => {
    expect(exampleFindings('p/.env.example', 'export FOO=\n')[0].level).toBe('ERROR');
  });
});

describe('scan', () => {
  const files = (tracked, contents = {}) => ({ tracked, read: p => contents[p] ?? '' });

  it('fails on any tracked env file, without reading it', () => {
    const read = p => { throw new Error('must not read ' + p); };
    const result = scan({ tracked: ['packages/a/.env', 'packages/a/.env.local', 'README.md'], read });
    expect(result.filter(f => f.level === 'ERROR').map(f => f.path)).toEqual(['packages/a/.env', 'packages/a/.env.local']);
  });

  it('warns on the legacy root example and on application packages without an example', () => {
    const result = scan(files(
      ['.env.example', 'packages/a/src/cli.ts', 'packages/b/src/index.ts', 'packages/c/src/main.py',
       'packages/d/src/run.ts', 'packages/d/.env.example'],
      { 'packages/a/src/cli.ts': 'const x = process.env.A_ENDPOINT;', 'packages/b/src/index.ts': 'export const y = 1;',
        'packages/c/src/main.py': 'import os\nos.environ.get("C_TOKEN")', 'packages/d/src/run.ts': 'process.env.D',
        'packages/d/.env.example': 'D=\n' },
    ));
    expect(result).toEqual([
      { level: 'WARN', path: '.env.example', message: 'repository-level example: move its keys into the package that reads them' },
      { level: 'WARN', path: 'packages/a', message: 'reads its environment but has no .env.example (migrate to a settings module)' },
      { level: 'WARN', path: 'packages/c', message: 'reads its environment but has no .env.example (migrate to a settings module)' },
    ]);
  });

  it('ignores test files when deciding whether a package reads its environment', () => {
    const result = scan(files(['packages/e/src/__tests__/x.test.ts'], { 'packages/e/src/__tests__/x.test.ts': 'process.env.X' }));
    expect(result).toEqual([]);
  });
});
