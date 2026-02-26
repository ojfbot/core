# Secret Detection Patterns

Patterns that indicate sensitive values that must not be committed. Check staged files against these before committing.

## High-confidence patterns (block immediately)

```
# API keys and tokens
[A-Z_]{5,}_API_KEY\s*=\s*["\']?[A-Za-z0-9_\-]{20,}
[A-Z_]{5,}_TOKEN\s*=\s*["\']?[A-Za-z0-9_\-\.]{20,}
[A-Z_]{5,}_SECRET\s*=\s*["\']?[A-Za-z0-9_\-]{20,}

# Anthropic / OpenAI
sk-ant-[A-Za-z0-9\-_]{40,}
sk-[A-Za-z0-9]{40,}

# GitHub tokens
ghp_[A-Za-z0-9]{36}
gho_[A-Za-z0-9]{36}
github_pat_[A-Za-z0-9_]{82}

# AWS
AKIA[0-9A-Z]{16}
[0-9a-zA-Z/+]{40}  (when preceded by aws_secret_access_key)

# Private keys
-----BEGIN [A-Z ]+ PRIVATE KEY-----

# JWT (only flag if it looks like a real signed token, not a placeholder)
eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}

# Generic high-entropy strings assigned to secret-named vars
password\s*=\s*["\'][^"\']{8,}["\']
passwd\s*=\s*["\'][^"\']{8,}["\']
```

## Files that should never be committed

```
.env
.env.local
.env.production
.env.*.local
*.pem
*.key (private key files)
id_rsa
id_ed25519
*.pfx
*.p12
credentials.json
service-account*.json
```

## False positives (do not block)

```
# Placeholder values
ANTHROPIC_API_KEY=your-api-key-here
API_KEY=<YOUR_KEY>
TOKEN=xxx
SECRET=changeme
PASSWORD=password  (in test files only)

# Example/documentation values
sk-ant-example...
AKIA0000000000000000

# Environment variable references (not values)
process.env.ANTHROPIC_API_KEY
os.environ.get('API_KEY')
$API_KEY
${TOKEN}
```

## File types to always scan

- `.env*` files (should never be staged)
- `.json` files (config, credentials)
- `.yaml` / `.yml` files (CI configs, Kubernetes secrets)
- TypeScript/JavaScript source files
- Python source files
- Shell scripts

## Files to skip

- `node_modules/`
- `dist/`
- `*.test.*` (unless the test literally embeds a real credential — warn but don't block)
- `*.md` (documentation rarely contains real secrets, but check for embedded code blocks)

## How to report findings

For each match:
```
BLOCKED: secret detected
File: path/to/file.ts
Line: 42
Pattern: ANTHROPIC_API_KEY = sk-ant-...
Action: Remove the value before committing. Use process.env.ANTHROPIC_API_KEY instead.
```
