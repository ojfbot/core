# Package settings templates (adr:package-env-files)

Every application package in core keeps its own `packages/<name>/.env`, which is never committed, and reads it
through exactly one settings module.

| File | Copy to |
|---|---|
| `.env.example` | `packages/<name>/.env.example` (committed; blank or `<placeholder>` values) |
| `settings.ts` | `packages/<name>/src/settings.ts` (TypeScript packages) |
| `settings.py` | the Python package's source root (Python packages) |

**How the modules resolve values**
- They read `packages/<name>/.env` when it exists, and refuse it unless it is mode 600.
- Real environment variables override the file.
- They return a frozen object of named constants (`settings.endpoint`).
- A `*_FILE` key names a private secret file, and its contents become a named constant.
- Errors name the key, never the value.

`settings.ts` and `settings.py` are tested where they sit (`scripts/lib/__tests__/package-settings-template.test.mjs`,
`test_settings.py`), so a copy starts from working code. `scripts/env-files-check.mjs` (CI) fails on any tracked env
file or real-looking example value.
