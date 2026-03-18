#!/usr/bin/env node
/**
 * find-console-logs.js
 *
 * Finds console.* calls in non-test, non-script source files.
 * Usage: node find-console-logs.js [--path=./src]
 *
 * Output: JSON array of { file, line, column, match }
 */

'use strict'

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const rootArg = args.find(a => a.startsWith('--path='))
const ROOT = rootArg ? rootArg.replace('--path=', '') : process.cwd()

// File extensions to scan
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git',
  'coverage', '.next', '__pycache__', '.venv',
])

// File patterns to skip (test/script files)
const SKIP_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__/,
  /\/scripts\//,
]

// Console methods to flag
const CONSOLE_RE = /\bconsole\.(log|debug|info|warn|error|trace|dir|table)\s*\(/g

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(p => p.test(filePath))
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const findings = []

  lines.forEach((line, i) => {
    // Skip lines that are comments
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return

    let match
    CONSOLE_RE.lastIndex = 0
    while ((match = CONSOLE_RE.exec(line)) !== null) {
      findings.push({
        file: path.relative(ROOT, filePath),
        line: i + 1,
        column: match.index + 1,
        match: match[0].replace('(', '(…)'),
        snippet: line.trim().slice(0, 80),
      })
    }
  })

  return findings
}

function walk(dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...walk(full))
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (EXTENSIONS.has(ext) && !shouldSkipFile(full)) {
        results.push(...scanFile(full))
      }
    }
  }

  return results
}

const findings = walk(path.resolve(ROOT))
process.stdout.write(JSON.stringify(findings, null, 2) + '\n')
process.exitCode = findings.length > 0 ? 1 : 0
