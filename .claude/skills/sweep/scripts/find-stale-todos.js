#!/usr/bin/env node
/**
 * find-stale-todos.js
 *
 * Finds TODO/FIXME/HACK comments with optional age detection via git blame.
 * Usage: node find-stale-todos.js [--path=./src] [--days=90] [--no-git]
 *
 * Output: JSON array of { file, line, tag, text, age_days?, date? }
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const args = process.argv.slice(2)
const rootArg = args.find(a => a.startsWith('--path='))
const daysArg = args.find(a => a.startsWith('--days='))
const noGit = args.includes('--no-git')

const ROOT = rootArg ? rootArg.replace('--path=', '') : process.cwd()
const STALE_DAYS = daysArg ? parseInt(daysArg.replace('--days=', ''), 10) : 90

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.md'])

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git',
  'coverage', '.next', '__pycache__', '.venv',
])

const TODO_RE = /\b(TODO|FIXME|HACK|XXX|NOTE)\s*[:\-]?\s*(.+)/gi

function gitBlameDate(filePath, lineNum) {
  try {
    const out = execSync(
      `git blame -L ${lineNum},${lineNum} --date=iso "${filePath}" 2>/dev/null`,
      { encoding: 'utf-8', cwd: ROOT, timeout: 5000 },
    )
    const dateMatch = out.match(/(\d{4}-\d{2}-\d{2})/)
    return dateMatch ? dateMatch[1] : null
  } catch {
    return null
  }
}

function ageInDays(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const findings = []

  lines.forEach((line, i) => {
    TODO_RE.lastIndex = 0
    let match
    while ((match = TODO_RE.exec(line)) !== null) {
      const lineNum = i + 1
      let date = null
      let ageDays = null

      if (!noGit) {
        date = gitBlameDate(filePath, lineNum)
        ageDays = ageInDays(date)
      }

      findings.push({
        file: path.relative(ROOT, filePath),
        line: lineNum,
        tag: match[1].toUpperCase(),
        text: match[2].trim().slice(0, 120),
        date,
        age_days: ageDays,
        stale: ageDays !== null ? ageDays >= STALE_DAYS : null,
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
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      results.push(...scanFile(full))
    }
  }

  return results
}

const findings = walk(path.resolve(ROOT))
  .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0))

process.stdout.write(JSON.stringify(findings, null, 2) + '\n')
