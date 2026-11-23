// trust-phase-proof.mjs — the shared phase-end check for the agent trust build's layer retros
// (RETRO-0 to RETRO-5, fleet roadmap phases PH8–PH13; ojfbot/core#687).
//
// A layer retro may close only when every other slice of its phase is closed AND left its proof:
//
//   - a slice whose roadmap deliverable is "A reviewed PR closing <repo>#N" needs the issue's
//     last close event to name, as its closer, a merged pull request in that same repo (or a
//     commit that belongs to one). A merged PR that is only linked, or a hand close after it,
//     is not proof: GitHub closes an issue from a PR only when the PR lands on the default branch;
//   - an owner step ("Owner step recorded on <repo>#N") needs the issue closed as completed —
//     "not planned" fails. A script cannot yet tell the owner's close from an agent's (that waits
//     on the per-Mac GitHub Apps, ojfbot/core#681), so the retro reads owner steps by hand;
//   - every slice's "Deviations and discoveries" section must no longer hold the "_(none yet)_"
//     placeholder it was filed with: it lists entries, or says "None.".
//
// Whether review findings were handled is a human read in the retro; nothing here checks it.
//
// Pure functions only. The CLI (scripts/check-trust-phase-proof.mjs) fetches from GitHub and
// passes the records in, so tests can run without the network.

export const LAYER_LABELS = Object.freeze({
  PH8: 'layer:0-phase0',
  PH9: 'layer:1-enforcement',
  PH10: 'layer:2-outside-review',
  PH11: 'layer:3-evidence',
  PH12: 'layer:4-seats-stops',
  PH13: 'layer:5-tests-lane',
});

/** Repos that carry trust build slice issues. */
export const SLICE_REPOS = Object.freeze(['ojfbot/core', 'ojfbot/LocalHelp', 'ojfbot/daily-logger']);

export const PLACEHOLDER = '_(none yet)_';
// The placeholder in any emphasis or case an editor round-trip might leave ("*(None yet)*").
const PLACEHOLDER_RE = /[_*]{0,2}\(\s*none yet\s*\)[_*]{0,2}/i;
const DEVIATIONS_TITLE = /^Deviations and discoveries$/i;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
// The three rule bullets every slice issue was filed with; they are template, not entries.
const TEMPLATE_BULLET = /^(?:[-*+]|\d+[.)])\s+A discovery that\b/;
const ENTRY = /^(?:[-*+]|\d+[.)])\s+\S/;
const NONE_LINE = /^(?:(?:[-*+]|\d+[.)])\s+)?None\.?$/i;

const DELIVERABLE_FORMS = [
  { kind: 'pr', re: /^A reviewed PR closing (ojfbot\/[A-Za-z0-9._-]+)#(\d+)\b/ },
  { kind: 'owner', re: /^Owner step recorded on (ojfbot\/[A-Za-z0-9._-]+)#(\d+)\b/ },
];

const sameRepo = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export const issueKey = (repo, number) => `${String(repo).toLowerCase()}#${number}`;

/** Parse a roadmap deliverable into the proof it names, or null if it names none we know. */
export function parseDeliverable(deliverable) {
  const text = typeof deliverable === 'string' ? deliverable.trim() : '';
  for (const { kind, re } of DELIVERABLE_FORMS) {
    const m = re.exec(text);
    if (m) return { kind, repo: m[1], number: Number(m[2]) };
  }
  return null;
}

/** The slice's short ID ("HD-1a") from a roadmap title ("HD-1a — ..."). */
export function sliceName(title) {
  return String(title ?? '').split(' — ')[0].trim();
}

/**
 * The phase's slices from the parsed roadmap, minus the phase's own retro.
 * Returns { slices, retros, unparsed } — unparsed rows are a failure, never skipped.
 */
export function phaseSlices(roadmap, phase) {
  const rows = (roadmap?.slices ?? []).filter((s) => s.phase === phase);
  const retros = rows.filter((s) => /^RETRO-\d+$/.test(sliceName(s.title)));
  const slices = [];
  const unparsed = [];
  for (const s of rows) {
    if (retros.includes(s)) continue;
    const proof = parseDeliverable(s.deliverable);
    const entry = { rm: s.id, name: sliceName(s.title), deliverable: s.deliverable };
    if (proof) slices.push({ ...entry, ...proof });
    else unparsed.push(entry);
  }
  return { slices, retros, unparsed };
}

/**
 * Split a Markdown body into lines tagged with whether they are prose (outside code fences and
 * HTML comments) and, for prose headings, their level and text.
 */
function markdownLines(body) {
  const out = [];
  let fence = null;
  let comment = false;
  for (const line of String(body ?? '').split(/\r?\n/)) {
    if (fence) {
      const m = FENCE.exec(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1].replace(/\s+$/, '').trim()) fence = null;
      out.push({ line, prose: false });
      continue;
    }
    if (comment) {
      if (line.includes('-->')) comment = false;
      out.push({ line, prose: false });
      continue;
    }
    const f = FENCE.exec(line);
    if (f) {
      fence = f[1];
      out.push({ line, prose: false });
      continue;
    }
    if (/^\s*<!--/.test(line) && !line.includes('-->')) {
      comment = true;
      out.push({ line, prose: false });
      continue;
    }
    const h = HEADING.exec(line);
    out.push(h ? { line, prose: true, level: h[1].length, title: h[2] } : { line, prose: true });
  }
  return out;
}

/**
 * The "Deviations and discoveries" section: its lines (tagged as in markdownLines), from its
 * heading to the next real heading of the same or a higher rank. Headings inside code fences or
 * comments do not count. Returns { lines } or { error } when the section is absent or repeated.
 */
export function deviationsSection(body) {
  const lines = markdownLines(body);
  const starts = lines.flatMap((l, i) => (l.level && DEVIATIONS_TITLE.test(l.title) ? [i] : []));
  if (starts.length === 0) return { error: 'no "Deviations and discoveries" section' };
  if (starts.length > 1) return { error: `${starts.length} "Deviations and discoveries" sections — keep exactly one` };
  const level = lines[starts[0]].level;
  const rest = lines.slice(starts[0] + 1);
  const end = rest.findIndex((l) => l.level && l.level <= level);
  return { lines: end < 0 ? rest : rest.slice(0, end) };
}

/** Has the builder replaced the placeholder with entries or a plain "None."? */
export function deviationsVerdict(body) {
  const section = deviationsSection(body);
  if (section.error) return { ok: false, reason: section.error };
  // Any copy of the placeholder in the section fails, even inside a code block.
  if (section.lines.some((l) => PLACEHOLDER_RE.test(l.line))) {
    return {
      ok: false,
      reason: `"Deviations and discoveries" still holds the "${PLACEHOLDER}" placeholder — replace it with the slice's entries, or a plain "None." line`,
    };
  }
  // Only prose counts as an entry or a "None." line, never text inside a code block or comment.
  const prose = section.lines.filter((l) => l.prose && !l.level).map((l) => l.line.trim());
  const entries = prose.filter((l) => ENTRY.test(l) && !TEMPLATE_BULLET.test(l));
  if (entries.length > 0 || prose.some((l) => NONE_LINE.test(l))) return { ok: true };
  return {
    ok: false,
    reason: '"Deviations and discoveries" has no entries (list items) and no "None." line',
  };
}

/**
 * Did the issue's last close event come from a merged PR in `repo`? The closer is the PR itself,
 * or a commit whose associated PRs include a merged one in `repo`.
 */
export function closedByMergedPr(issue, repo) {
  const events = issue?.timelineItems?.nodes ?? [];
  const closer = events.length ? events[events.length - 1]?.closer : null;
  if (!closer) return false;
  const ok = (pr) => pr?.merged === true && sameRepo(pr.repository?.nameWithOwner, repo);
  if (closer.__typename === 'PullRequest') return ok(closer);
  if (closer.__typename === 'Commit') return (closer.associatedPullRequests?.nodes ?? []).some(ok);
  return false;
}

/** Problems with one slice's issue record (empty list = the slice left its proof). */
export function sliceProblems(slice, issue) {
  if (!issue) return [`${slice.repo}#${slice.number} could not be read`];
  const problems = [];
  if (issue.state !== 'CLOSED') {
    problems.push('still open');
  } else if (issue.stateReason !== 'COMPLETED') {
    problems.push(`closed as ${String(issue.stateReason ?? 'unknown').toLowerCase().replace(/_/g, ' ')}, not completed`);
  }
  if (slice.kind === 'pr' && issue.state === 'CLOSED' && !closedByMergedPr(issue, slice.repo)) {
    problems.push(`its last close was not by a merged pull request in ${slice.repo} (a linked PR or a hand close is not proof)`);
  }
  const dev = deviationsVerdict(issue.body);
  if (!dev.ok) problems.push(dev.reason);
  return problems;
}

/**
 * Judge a phase.
 * @param {object} p
 * @param {string} p.phase             roadmap phase ID, e.g. "PH8"
 * @param {object} p.roadmap           parsed roadmap frontmatter
 * @param {Map<string, object>} p.issues   issueKey -> GitHub issue record
 * @param {Array<{repo:string, number:number, state:string, labels:string[]}>} p.labelled
 *        every issue carrying the phase's layer label and `trust-slice`, any state, all repos
 * @returns {{ ok: boolean, problems: string[], results: Array<{slice:object, problems:string[]}> }}
 */
export function evaluatePhase({ phase, roadmap, issues, labelled }) {
  const problems = [];
  const layer = LAYER_LABELS[phase];
  if (!Object.hasOwn(LAYER_LABELS, phase)) return { ok: false, problems: [`unknown phase ${phase}: expected one of ${Object.keys(LAYER_LABELS).join(', ')}`], results: [] };

  const { slices, retros, unparsed } = phaseSlices(roadmap, phase);
  if (retros.length !== 1) problems.push(`${phase} has ${retros.length} RETRO rows in the roadmap, expected exactly 1`);
  for (const u of unparsed) {
    problems.push(`${u.rm} ${u.name}: deliverable names no proof this check knows ("${u.deliverable}")`);
  }
  if (slices.length === 0) problems.push(`${phase} has no slices to check — refusing to pass an empty phase`);

  // The label view (what the old command counted) must agree with the roadmap.
  const nonRetro = (labelled ?? []).filter((i) => !(i.labels ?? []).includes('trust-retro'));
  if (nonRetro.length === 0) problems.push(`no issue carries ${layer} and trust-slice — refusing to pass on zero matches`);
  const labelKeys = new Set(nonRetro.map((i) => issueKey(i.repo, i.number)));
  const sliceKeys = new Set(slices.map((s) => issueKey(s.repo, s.number)));
  for (const s of slices) {
    if (!labelKeys.has(issueKey(s.repo, s.number))) problems.push(`${s.rm} ${s.name}: ${s.repo}#${s.number} is not labelled ${layer} + trust-slice`);
  }
  for (const i of nonRetro) {
    if (!sliceKeys.has(issueKey(i.repo, i.number))) problems.push(`${i.repo}#${i.number} is labelled ${layer} but is not a ${phase} slice in the roadmap`);
  }

  const results = slices.map((slice) => {
    const p = sliceProblems(slice, issues.get(issueKey(slice.repo, slice.number)));
    for (const x of p) problems.push(`${slice.rm} ${slice.name} (${slice.repo}#${slice.number}): ${x}`);
    return { slice, problems: p };
  });

  return { ok: problems.length === 0, problems, results };
}
