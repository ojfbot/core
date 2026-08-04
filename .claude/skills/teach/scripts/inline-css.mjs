#!/usr/bin/env node
// inline-css.mjs — the #386 build step. A step, not a build system.
//
// D23 said "self-contained lesson" AND "shared stylesheet in ./assets/". The #386 spike
// measured those as conflicting at the render boundary and the map amended D23: strip the
// sibling stylesheet and the lesson falls back to Times at an 8px body margin (0 rules
// loaded), losing every Tufte/printability opinion — while the inline quiz JS survives
// intact. Presentation is the fragile part, not interactivity.
//
// So: assets/lesson.css is the AUTHORING source (N lessons inherit one stylesheet, which is
// the right instinct for authoring); the SHIPPED lesson is build output with the CSS inlined.
// A deposited lesson is opened standalone from an Obsidian attachment — there is no sibling
// stylesheet at the other end.
//
// Usage: node inline-css.mjs <lesson.html> [--out=PATH] [--check]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const LINK_RE = /[ \t]*<link[^>]+rel=["']stylesheet["'][^>]*>\s*/gi;
const HREF_RE = /href=["']([^"']+)["']/i;

/**
 * Replace every <link rel=stylesheet> with an inline <style> carrying that file's rules.
 * PURE — resolution is injected so this is testable without a filesystem.
 *
 * @param {string} html
 * @param {(href:string) => string|null} readCss  returns CSS text, or null if unresolvable
 * @returns {{html:string, inlined:string[], missing:string[]}}
 */
export function inlineStylesheets(html, readCss) {
  const inlined = [];
  const missing = [];
  const out = String(html).replace(LINK_RE, (tag) => {
    const href = HREF_RE.exec(tag)?.[1];
    if (!href) return tag;
    const css = readCss(href);
    if (css == null) {
      // Leave the link in place. Silently dropping it would ship a lesson that renders as
      // Times/8px — the exact failure #386 measured — with nothing to show it happened.
      missing.push(href);
      return tag;
    }
    inlined.push(href);
    return `<style>\n/* inlined from ${href} — #386: shipped lessons are self-contained */\n${css.trim()}\n</style>\n`;
  });
  return { html: out, inlined, missing };
}

/**
 * Does this HTML still depend on a sibling file to render? The check the deposit step runs —
 * a lesson that fails it will lose its Tufte opinions the moment it leaves the worktree.
 *
 * @param {string} html
 * @returns {boolean}
 */
export function isSelfContained(html) {
  LINK_RE.lastIndex = 0;
  return !LINK_RE.test(String(html));
}

function parseArgs(argv) {
  const out = { _: [] };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
    else out._.push(a);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const src = args._[0];
  if (!src || !existsSync(src)) {
    console.error('[teach:inline-css] usage: inline-css.mjs <lesson.html> [--out=PATH] [--check]');
    process.exitCode = 1;
    return;
  }
  const html = readFileSync(src, 'utf8');

  if (args.check) {
    const ok = isSelfContained(html);
    console.error(`[teach:inline-css] ${src}: ${ok ? 'self-contained' : 'NOT self-contained — has external stylesheet link(s)'}`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  const base = dirname(resolve(src));
  const result = inlineStylesheets(html, (href) => {
    if (/^https?:/i.test(href)) return null;
    const p = resolve(base, href);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  });

  const out = args.out ?? src;
  writeFileSync(out, result.html);
  console.error(`[teach:inline-css] ${out}: inlined ${result.inlined.length} stylesheet(s)${result.missing.length ? `; UNRESOLVED: ${result.missing.join(', ')}` : ''}`);
  if (result.missing.length) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('inline-css.mjs');
if (invokedDirectly) main();
