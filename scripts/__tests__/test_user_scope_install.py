"""Isolated user-scope rollout and runtime regression checks (stdlib only)."""
import json
import os
import shlex
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

CORE = Path(__file__).resolve().parents[2]
NODE = shutil.which('node')


class UserScopeInstall(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(NODE, 'Node.js must be on PATH for runtime hook checks')
        self.tmp = tempfile.TemporaryDirectory(prefix='core-skill-install-')
        self.home = Path(self.tmp.name)
        self.env = dict(os.environ, HOME=str(self.home))
        self.env['PATH'] = str(Path(NODE).parent) + os.pathsep + self.env['PATH']
        self.settings = self.home / '.claude/settings.json'
        self.repo = self.home / 'fixture-repo'
        self.repo.mkdir()
        (self.repo / 'implementation-notes.md').write_text('## Deviations\n- Fixture deviation for runtime coverage.\n')

    def tearDown(self):
        self.tmp.cleanup()

    def install(self, *args, ok=True):
        r = subprocess.run(['bash', str(CORE / 'scripts/install-agents.sh'), '--user-scope', *args],
                           env=self.env, cwd=self.repo, capture_output=True, text=True)
        if ok:
            self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        else:
            self.assertNotEqual(r.returncode, 0)
        return r

    def seed_settings(self, data):
        self.settings.parent.mkdir(exist_ok=True)
        self.settings.write_text(json.dumps(data))

    def run_hooks(self):
        data = json.loads(self.settings.read_text()) if self.settings.exists() else {}
        for entries in data.get('hooks', {}).values():
            for entry in entries:
                for hook in entry.get('hooks', []):
                    r = subprocess.run(hook['command'], shell=True, executable='/bin/bash',
                                       input=json.dumps({'session_id': 'fixture', 'cwd': str(self.repo),
                                                         'tool_input': {'command': 'git merge fixture'}}),
                                       env=self.env, cwd=self.repo, capture_output=True, text=True)
                    self.assertEqual(r.returncode, 0, r.stderr)

    def test_default_install_has_valid_skills_and_no_runtime_vault_writes(self):
        self.install()
        links = list((self.home / '.claude/skills').iterdir())
        self.assertGreater(len(links), 0)
        self.assertTrue(all(p.is_symlink() and (p / 'SKILL.md').is_file() for p in links))
        self.assertFalse((self.home / '.claude/skills/vault').exists())
        self.run_hooks()
        self.assertFalse((self.home / 'selfco').exists())
        self.assertFalse(self.settings.exists())
        instructions = (self.home / '.claude/CLAUDE.md').read_text()
        self.assertNotIn('/Users/yuri/', instructions)

    def test_default_repeat_preserves_existing_settings_and_user_instructions(self):
        data = {'permissions': {'deny': ['Read(private/**)']},
                'hooks': {'Stop': [{'hooks': [{'type': 'command', 'command': 'true'}]}]}}
        self.seed_settings(data)
        (self.home / '.claude/CLAUDE.md').write_text('# My own instructions\n')
        before = self.settings.read_bytes()
        self.install()
        self.install()
        self.assertEqual(self.settings.read_bytes(), before)
        instructions = (self.home / '.claude/CLAUDE.md').read_text()
        self.assertTrue(instructions.startswith('# My own instructions'))
        self.assertEqual(instructions.count('<!-- managed:start'), 1)

    def test_explicit_ledger_runtime_and_repeat_install(self):
        ledger = self.home / "private ledger 'quoted' $literal"
        data = {'permissions': {'allow': ['Read']}, 'hooks': {
            'Stop': [{'matcher': 'custom', 'hooks': [{'type': 'command', 'command': 'true'}]}]}}
        self.seed_settings(data)
        self.install('--telemetry-dir=' + str(ledger))
        first = json.loads(self.settings.read_text())
        self.install('--telemetry-dir=' + str(ledger))
        self.assertEqual(json.loads(self.settings.read_text()), first)
        self.assertEqual(first['permissions'], data['permissions'])
        self.assertEqual(first['hooks']['Stop'][0], data['hooks']['Stop'][0])
        self.run_hooks()
        self.assertTrue((ledger / 'loop-health.jsonl').is_file())
        self.assertTrue((ledger / 'deviations.jsonl').is_file())
        self.assertTrue((ledger / 'merge-observations.jsonl').is_file())
        self.assertFalse((self.home / 'selfco').exists())

    def test_explicit_ledger_repoints_owned_hooks_without_duplicate_registration(self):
        self.seed_settings({'hooks': {'Stop': [{'hooks': [
            {'type': 'command', 'command': 'node /old/core/scripts/hooks/reconcile-skill-acted.mjs', 'async': True},
            {'type': 'command', 'command': 'true'}]}]}})
        self.install('--telemetry-dir=' + str(self.home / 'ledger'))
        hooks = json.loads(self.settings.read_text())['hooks']['Stop']
        matching = [h for e in hooks for h in e['hooks'] if 'reconcile-skill-acted.mjs' in h['command']]
        self.assertEqual(len(matching), 1)
        self.assertIn('--ledger-root', matching[0]['command'])
        self.assertNotIn('/old/core', matching[0]['command'])

    def test_invalid_ledger_rejected_before_install_writes(self):
        self.install('--telemetry-dir=', ok=False)
        self.assertFalse((self.home / '.claude').exists())
        self.install('--telemetry-dir=relative/path', ok=False)
        self.assertFalse((self.home / '.claude').exists())
        self.install('--telemetry-dir=' + str(self.home / 'selfco/tracking'), ok=False)
        self.assertFalse((self.home / '.claude').exists())
        self.assertFalse((self.home / 'selfco').exists())

    def test_vault_symlink_destination_rejected_before_install_writes(self):
        vault = self.home / 'selfco'
        vault.mkdir()
        alias = self.home / 'innocent-looking-ledger'
        alias.symlink_to(vault, target_is_directory=True)
        self.install('--telemetry-dir=' + str(alias / 'tracking'), ok=False)
        self.assertFalse((self.home / '.claude').exists())
        self.assertEqual(list(vault.iterdir()), [])

    def test_configured_vault_guard_and_safe_runtime(self):
        vault = self.home / 'private-vault'
        self.env['SELFCO_VAULT'] = str(vault)
        self.install('--telemetry-dir=' + str(vault / 'tracking'), ok=False)
        self.assertFalse(self.settings.exists())
        self.assertFalse(vault.exists())
        alias = self.home / 'vault-alias'
        alias.symlink_to(vault, target_is_directory=True)
        self.install('--telemetry-dir=' + str(alias / 'tracking'), ok=False)
        self.assertFalse(self.settings.exists())
        # Configuring an alternate vault must not remove the default-root guard.
        self.install('--telemetry-dir=' + str(self.home / 'selfco/tracking'), ok=False)
        ledger = self.home / 'non-vault-ledger'
        self.install('--telemetry-dir=' + str(ledger))
        self.run_hooks()
        self.assertTrue((ledger / 'loop-health.jsonl').is_file())
        self.assertFalse(vault.exists())
        self.assertFalse((self.home / 'selfco').exists())

    def test_compound_custom_hooks_preserved_and_surfaced(self):
        script = '/old/core/scripts/hooks/reconcile-skill-acted.mjs'
        commands = [
            'node ' + script + ' && printf custom-marker',
            'node ' + script + ';printf custom-marker',
            'node ' + script + ' > custom.log',
            'node ' + script + ' --program=custom',
            'node "${CUSTOM_CORE}/reconcile-skill-acted.mjs"',
        ]
        for command in commands:
            with self.subTest(command=command):
                original = {'type': 'command', 'command': command, 'async': True}
                self.seed_settings({'hooks': {'Stop': [{'hooks': [original]}]}})
                result = self.install('--telemetry-dir=' + str(self.home / 'ledger'))
                hooks = json.loads(self.settings.read_text())['hooks']['Stop']
                matching = [h for e in hooks for h in e['hooks'] if 'reconcile-skill-acted.mjs' in h['command']]
                self.assertEqual(matching, [original])
                self.assertIn('destination is unmodified', result.stderr)
                self.assertIn('migrate it manually', result.stderr)

    def test_generated_quoted_commands_can_be_repointed(self):
        first = self.home / "ledger 'quoted' $literal"
        self.install('--telemetry-dir=' + str(first))
        second = self.home / 'new-ledger'
        result = self.install('--telemetry-dir=' + str(second))
        self.assertNotIn('custom ', result.stderr)
        settings = json.loads(self.settings.read_text())
        for entries in settings['hooks'].values():
            for entry in entries:
                for hook in entry['hooks']:
                    self.assertIn('--ledger-root=' + str(second.resolve()), shlex.split(hook['command']))
        self.run_hooks()
        self.assertTrue((second / 'loop-health.jsonl').is_file())
        self.assertFalse(first.exists())


if __name__ == '__main__':
    unittest.main()
