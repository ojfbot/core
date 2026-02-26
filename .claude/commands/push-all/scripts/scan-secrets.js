#!/usr/bin/env node
/**
 * scan-secrets.js
 *
 * Scans git-staged files for patterns that look like secrets.
 * Usage: node scan-secrets.js
 *        echo "content" | node scan-secrets.js --stdin
 *
 * Output: JSON { blocked: boolean, findings: [{ file, line, pattern, snippet }] }
 * Exit code: 1 if blocked, 0 if clean
 */

'use strict'

const { execSync } = require('child_process')

// Patterns that BLOCK the commit
const BLOCK_PATTERNS = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9\-_]{40,}/ },
  { name: 'OpenAI API key', re: /sk-[A-Za-z0-9]{40,}/ },
  { name: 'GitHub PAT (classic)', re: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'GitHub PAT (fine-grained)', re: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: 'GitHub OAuth token', re: /gho_[A-Za-z0-9]{36}/ },
  { name: 'AWS access key ID', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Private key header', re: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/ },
  { name: 'Generic API key assignment', re: /[A-Z_]{5,}_(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*["']?(?!(?:your|example|changeme|placeholder|xxx|<)[^"'\s]{0,30}["'\s])[A-Za-z0-9+/\-_]{20,}/ },
]

// Patterns that WARN but don't block
const WARN_PATTERNS = [
  { name: 'Hardcoded password', re: /password\s*=\s*["'][^"']{8,}["']/ },
  { name: 'JWT token (real)', re: /eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/ },
]

// Files that should never be staged
const BLOCKED_FILENAMES = ['.env', '.env.production', '.env.local']

function getStagedDiff() {
  try {
    return execSync('git diff --cached --unified=0', { encoding: 'utf-8', timeout: 10000 })
  } catch {
    return ''
  }
}

function parseDiff(diff) {
  const files = []
  let currentFile = null
  let currentLines = []
  let lineNum = 0

  for (const rawLine of diff.split('\n')) {
    if (rawLine.startsWith('diff --git')) {
      if (currentFile) files.push({ file: currentFile, lines: currentLines })
      const match = rawLine.match(/b\/(.+)$/)
      currentFile = match ? match[1] : null
      currentLines = []
    } else if (rawLine.startsWith('@@')) {
      const match = rawLine.match(/@@ [^+]*\+(\d+)/)
      lineNum = match ? parseInt(match[1], 10) - 1 : 0
    } else if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lineNum++
      currentLines.push({ n: lineNum, content: rawLine.slice(1) })
    } else if (!rawLine.startsWith('-')) {
      lineNum++
    }
  }

  if (currentFile) files.push({ file: currentFile, lines: currentLines })
  return files
}

function scanFiles(files) {
  const blocked = []
  const warnings = []

  for (const { file, lines } of files) {
    // Check filename
    const basename = file.split('/').pop()
    if (BLOCKED_FILENAMES.some(f => basename === f || basename.startsWith('.env.'))) {
      blocked.push({ file, line: 0, pattern: 'Blocked filename', snippet: file, severity: 'BLOCK' })
    }

    for (const { n, content } of lines) {
      for (const { name, re } of BLOCK_PATTERNS) {
        if (re.test(content)) {
          blocked.push({
            file, line: n, pattern: name,
            snippet: content.trim().slice(0, 80),
            severity: 'BLOCK',
          })
        }
      }

      for (const { name, re } of WARN_PATTERNS) {
        if (re.test(content)) {
          warnings.push({
            file, line: n, pattern: name,
            snippet: content.trim().slice(0, 80),
            severity: 'WARN',
          })
        }
      }
    }
  }

  return { blocked, warnings }
}

const diff = getStagedDiff()
const files = parseDiff(diff)
const { blocked, warnings } = scanFiles(files)

const result = {
  blocked: blocked.length > 0,
  findings: [...blocked, ...warnings],
}

process.stdout.write(JSON.stringify(result, null, 2) + '\n')
process.exitCode = blocked.length > 0 ? 1 : 0
