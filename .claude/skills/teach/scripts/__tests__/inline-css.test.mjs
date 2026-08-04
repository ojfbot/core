// inline-css.test.mjs — the #386 build step. The spike measured that stripping the sibling
// stylesheet drops a lesson to Times at an 8px margin (0 rules loaded) while the inline quiz
// JS survives: presentation is the fragile part. These tests hold that boundary.

import { describe, it, expect } from 'vitest';
import { inlineStylesheets, isSelfContained } from '../inline-css.mjs';

const CSS = 'body { max-width: 34em; font-family: et-book, Palatino, serif; }';
const read = (href) => (href === 'assets/lesson.css' ? CSS : null);

describe('inlineStylesheets', () => {
  it('replaces the authoring stylesheet link with the rules themselves', () => {
    const html = '<head><link rel="stylesheet" href="assets/lesson.css"></head>';
    const r = inlineStylesheets(html, read);
    expect(r.html).toContain('<style>');
    expect(r.html).toContain('max-width: 34em');
    expect(r.html).not.toContain('<link');
    expect(r.inlined).toEqual(['assets/lesson.css']);
  });

  it('leaves an unresolvable link in place and reports it, rather than shipping a silent Times fallback', () => {
    const html = '<link rel="stylesheet" href="missing.css">';
    const r = inlineStylesheets(html, read);
    expect(r.missing).toEqual(['missing.css']);
    expect(r.html).toContain('<link');
    expect(r.inlined).toEqual([]);
  });

  it('handles several stylesheets and single quotes', () => {
    const html = `<link rel='stylesheet' href='assets/lesson.css'><link rel="stylesheet" href="assets/lesson.css">`;
    const r = inlineStylesheets(html, read);
    expect(r.inlined).toHaveLength(2);
    expect(isSelfContained(r.html)).toBe(true);
  });

  it('leaves inline quiz JS untouched — interactivity was never the fragile part', () => {
    const html = '<link rel="stylesheet" href="assets/lesson.css"><script>const answer=2;</script>';
    const r = inlineStylesheets(html, read);
    expect(r.html).toContain('<script>const answer=2;</script>');
  });

  it('is a no-op on an already self-contained lesson', () => {
    const html = '<style>body{}</style><p>hi</p>';
    const r = inlineStylesheets(html, read);
    expect(r.html).toBe(html);
    expect(r.inlined).toEqual([]);
  });
});

describe('isSelfContained — the check the deposit runs', () => {
  it('is false while an external stylesheet link remains', () => {
    expect(isSelfContained('<link rel="stylesheet" href="a.css">')).toBe(false);
  });

  it('is true once inlined, and stateless across repeated calls', () => {
    const html = '<style>body{}</style>';
    expect(isSelfContained(html)).toBe(true);
    expect(isSelfContained(html)).toBe(true);
  });

  it('does not mistake a non-stylesheet link for a dependency', () => {
    expect(isSelfContained('<link rel="icon" href="f.png">')).toBe(true);
  });
});
