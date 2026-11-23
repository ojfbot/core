// trust-phase-proof.mjs — the shared phase-end check for the agent trust build's layer retros
// (RETRO-0 to RETRO-5, fleet roadmap phases PH8–PH13; ojfbot/core#687).
//
// A layer retro may close only when every other slice of its phase is closed AND left its proof:
//
//   - a slice whose roadmap deliverable is "A reviewed PR closing <repo>#N" needs a merged pull
//     request in that same repo that GitHub records as closing the issue;
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
const DEVIATIONS_HEADING = /^#{2,4}\s+Deviations and discoveries\s*$/;
const ANY_HEADING = /^#{1,4}\s+\S/;
// The three rule bullets every slice issue was filed with; they are template, not entries.
const TEMPLATE_BULLET = /^[-*]\s+A discovery that\b/;
const NONE_LINE = /^(?:[-*]\s+)?None\.?$/i;

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

/** The text of the issue body's "Deviations and discoveries" section, or null if absent. */
export function deviationsSection(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const start = lines.findIndex((l) => DEVIATIONS_HEADING.test(l.trim()));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => ANY_HEADING.test(l.trim()));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** Has the builder replaced the placeholder with entries or a plain "None."? */
export function deviationsVerdict(body) {
  const section = deviationsSection(body);
  if (section == null) return { ok: false, reason: 'no "Deviations and discoveries" section' };
  if (section.includes(PLACEHOLDER)) {
    return {
      ok: false,
      reason: `"Deviations and discoveries" still holds the "${PLACEHOLDER}" placeholder — replace it with the slice's entries, or a plain "None." line`,
    };
  }
  const lines = section.split('\n').map((l) => l.trim());
  const entries = lines.filter((l) => /^[-*]\s+\S/.test(l) && !TEMPLATE_BULLET.test(l));
  if (entries.length > 0 || lines.some((l) => NONE_LINE.test(l))) return { ok: true };
  return {
    ok: false,
    reason: '"Deviations and discoveries" has no entries and no "None." line',
  };
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
  if (slice.kind === 'pr') {
    const closers = issue.closedByPullRequestsReferences?.nodes ?? [];
    const merged = closers.filter((pr) => pr?.merged === true && sameRepo(pr.repository?.nameWithOwner, slice.repo));
    if (merged.length === 0) problems.push(`no merged pull request in ${slice.repo} closes it`);
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
  if (!layer) return { ok: false, problems: [`unknown phase ${phase}: expected one of ${Object.keys(LAYER_LABELS).join(', ')}`], results: [] };

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
