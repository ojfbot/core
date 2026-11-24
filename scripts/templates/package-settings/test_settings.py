"""Tests for the Python package-settings template (adr:package-env-files). Run: python3 -I -m unittest discover
-s scripts/templates/package-settings -p 'test_*.py'"""
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import settings as S  # noqa: E402

SECRET = 'tok-' + 'S' * 32


class SettingsTemplateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.env = self.dir / '.env'
        self.token = self.dir / 'token'
        self.token.write_text(SECRET + '\n')
        self.token.chmod(0o600)

    def tearDown(self):
        self.tmp.cleanup()

    def write_env(self, text, mode=0o600):
        self.env.write_text(text)
        self.env.chmod(mode)

    def test_named_constants_from_the_package_env_with_the_environment_winning(self):
        self.write_env('# c\nEXAMPLE_ENDPOINT="https://a.invalid"\nEXAMPLE_TOKEN_FILE=%s\nEXAMPLE_WORKERS=4\n' % self.token)
        settings = S.load_settings({'EXAMPLE_WORKERS': '8'}, self.env)
        self.assertEqual((settings.endpoint, settings.token, settings.workers), ('https://a.invalid', SECRET, 8))
        with self.assertRaises(Exception):
            settings.workers = 1   # frozen
        self.assertNotIn(SECRET, repr(settings))

    def test_no_env_file_needed_when_the_environment_supplies_everything(self):
        settings = S.load_settings({'EXAMPLE_ENDPOINT': 'e', 'EXAMPLE_TOKEN_FILE': str(self.token)}, self.dir / 'none')
        self.assertEqual(settings.workers, 2)

    def test_refuses_readable_env_or_secret_files(self):
        self.write_env('EXAMPLE_ENDPOINT=e\nEXAMPLE_TOKEN_FILE=%s\n' % self.token, 0o644)
        with self.assertRaisesRegex(S.SettingsError, 'must be private'):
            S.load_settings({}, self.env)
        self.env.chmod(0o600)
        self.token.chmod(0o640)
        with self.assertRaisesRegex(S.SettingsError, 'the file named by EXAMPLE_TOKEN_FILE must be private'):
            S.load_settings({}, self.env)

    def test_errors_name_the_key_never_the_value(self):
        self.write_env('EXAMPLE_ENDPOINT=e\nEXAMPLE_TOKEN_FILE=%s\nEXAMPLE_WORKERS=%s\n' % (self.token, SECRET))
        with self.assertRaises(S.SettingsError) as caught:
            S.load_settings({}, self.env)
        self.assertEqual(str(caught.exception), 'EXAMPLE_WORKERS must be a whole number from 1 to 32')
        with self.assertRaisesRegex(S.SettingsError, '^missing setting: EXAMPLE_ENDPOINT$'):
            S.load_settings({'EXAMPLE_TOKEN_FILE': str(self.token)}, self.dir / 'none')

    def test_malformed_line(self):
        with self.assertRaisesRegex(S.SettingsError, r'\.env line 2 is not KEY=VALUE'):
            S.parse_env_file('OK=1\nexport BAD=2\n')


if __name__ == '__main__':
    unittest.main()
