"""settings.py: the ONLY place a Python package reads its environment (adr:package-env-files).

Copy to packages/<name>/settings.py (or the package's source root) and edit the SETTINGS section. Then:
  - list every key in packages/<name>/.env.example (blank or <placeholder> values, a comment each);
  - call load_settings() once at the entry point and pass the frozen object down;
  - never read os.environ anywhere else in the package.

Resolution: packages/<name>/.env (optional; must be mode 600), overridden by real environment variables, so a
deployment or a test can inject values. Errors name the key, never its value. Standard library only.
This template is itself tested (test_settings.py beside it).
"""
from dataclasses import dataclass
import os
from pathlib import Path
import re

KEY = re.compile(r'[A-Za-z_][A-Za-z0-9_]*')


class SettingsError(Exception):
    pass


def _private_text(path, label):
    try:
        mode = os.stat(path).st_mode
    except FileNotFoundError:
        return None
    except OSError:
        raise SettingsError(label + ' cannot be read') from None
    if mode & 0o077:
        raise SettingsError(label + ' must be private (chmod 600)')
    return Path(path).read_text(encoding='utf-8')


def parse_env_file(text):
    """KEY=VALUE lines; blank lines and # comments skipped; one pair of surrounding quotes stripped."""
    values = {}
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if not sep or not KEY.fullmatch(key):
            raise SettingsError('.env line %d is not KEY=VALUE' % number)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        values[key] = value
    return values


def load_env(path, environ=None):
    """The package's .env (if present), with real environment variables taking precedence."""
    environ = os.environ if environ is None else environ
    text = _private_text(path, 'the package .env')
    merged = parse_env_file(text) if text is not None else {}
    merged.update({k: v for k, v in environ.items() if v is not None})
    return merged


class Reader:
    def __init__(self, env):
        self.env = env

    def _get(self, key):
        value = (self.env.get(key) or '').strip()
        return value or None

    def required(self, key):
        value = self._get(key)
        if value is None:
            raise SettingsError('missing setting: ' + key)
        return value

    def optional(self, key, fallback):
        value = self._get(key)
        return fallback if value is None else value

    def integer(self, key, fallback, low, high):
        value = self._get(key)
        if value is None:
            return fallback
        if not value.isdigit() or not low <= int(value) <= high:
            raise SettingsError('%s must be a whole number from %d to %d' % (key, low, high))
        return int(value)

    def secret_file(self, key):
        """A *_FILE key: the path to a private secret file. Returns the secret, stripped."""
        text = _private_text(self.required(key), 'the file named by ' + key)
        secret = (text or '').strip()
        if not secret:
            raise SettingsError('the file named by %s is missing or empty' % key)
        return secret


# --- SETTINGS: edit this section for your package ----------------------------------------------------------------

PACKAGE_ENV = Path(__file__).resolve().parent / '.env'


@dataclass(frozen=True)
class Settings:
    endpoint: str
    token: str
    workers: int

    def __repr__(self):   # never print a secret by accident
        return 'Settings(endpoint=%r, token=<redacted>, workers=%r)' % (self.endpoint, self.workers)


def load_settings(environ=None, path=PACKAGE_ENV):
    r = Reader(load_env(path, environ))
    return Settings(endpoint=r.required('EXAMPLE_ENDPOINT'), token=r.secret_file('EXAMPLE_TOKEN_FILE'),
                    workers=r.integer('EXAMPLE_WORKERS', 2, 1, 32))
