---
type: wayfinder-map
slug: neistat-ai-bulletin
tracker_issue: 422
status: working
---

# Wayfinder — Neistat AI bulletin

## Destination

**Bulletin AI/04 ships**: the Camera Program's emphatic, ambivalent, paradoxical position-statement
on AI, in the Tom Sachs *Ten Bullets* numbered form that AI/01–AI/03 already established — with
**Van Neistat's published AI practice as its nearest living precedent**, and a **standing,
scheduled tracker** that keeps that precedent current without being asked.

Arrived means both halves hold: AI/04 exists as an editioned artifact in the Bulletin lineage, and
new Neistat AI material lands in the vault on a schedule, **tagged for bulletin-relevance rather
than merely archived**. The tracker is instrumental, not accretive — it earns its keep by feeding a
named object. That constraint is the whole point of pairing the two halves.

**Deliberately unanchored.** No `camera-program` northstar exists (the program has no repo — gap
G-03), and none of `l1-core`'s P1–P5 skill-loop properties fit a practice-and-vault initiative.
The anchor is omitted rather than forced (resolve-or-fail).

## Notes

### Operator rulings (2026-08-08)

- **Destination combines "bulletin" + "standing tracker."** The tracker is the mechanism; the
  bulletin is the reason. Neither alone is the Destination.
- **Capture fidelity for the subscription-side corpus: ruled, recorded in the private vault.**
  The specifics are deliberately not restated here (see the disclosure-seam ruling below). The
  destination surface is confirmed private; public-side capture is the RSS feed named above.
- **Adam Curtis: out of scope**, forked for dedicated sessions (see below).
- **Scheduling surface**: ruled in #426 — split, Pi transports LLM-free, a scheduled Routine
  authors. The chart-time worry that this collides with a "single-scheduler posture" was **wrong**:
  that posture is scoped to selfco-box (`com.ojfbot.selfco-box.*.plist.disabled`), while four
  unrelated fleet plists stay enabled on the Mac. Verified, not assumed.

### Facts gathered at chart time

*(These inform ticket bodies. They decide nothing — every decision below is still the operator's.)*

- Show logline, verbatim: **"tools, craft, and using AI to live more analog"** (vanneistat.com/about).
  This is the fleet thesis with the sign flipped — an analog craftsman running the same experiment
  from the opposite starting position.
- Primary AI corpus (all public YouTube): Long-Form 2 **"The machine dream was never real"**
  (`dG5pEiGhB_c`) is the spine episode; **"7 AI Principles for a simpler life"** (`H-ckdWpGjZw`);
  "Is it wrong to want an AI Agent?" (`4-ImXV23zb8`); "The Triumph of Natural Intelligence"
  (`qwhU-8rlKPw`); "How I search my video archive (it's not clever)" (`iumEFXQ8ubg`);
  **"Van Squared: A Free Local AI Model Labeled a 26-Year Archive"** (`mme027WZhgo`); the failure
  report short (`I9XGPL1wA8Q`); Long-Form 3 "Tickets, A Necktie & 26 Years of Footage"
  (`C8BsOTAol_o`, 2026-08-01).
- Named artifacts inside that corpus: **Johnny 5** (his footage-crawler agent), the AI manifesto,
  and a free local model labeling a 26-year footage archive.
- The honest negative result, verbatim: *"The plan was to use AI to live more analog… Three months
  in, the opposite happened. More screen, not less."* This is the most valuable single item in the
  corpus and the one a fan-cluster would smooth over.
- **Durable feed exists**, no scraping required:
  `https://www.youtube.com/feeds/videos.xml?channel_id=UC5mPJA4y5G8Z6aNkY6AxgAw`
  (15 most recent: titles, dates, descriptions).
- The fan companion site (`spiritedmancompanion.com`) has **no episode index, no transcripts, no
  API** — nothing to piggyback on.
- "The Spirited Man" is borrowed from Matthew B. Crawford, *Shop Class as Soulcraft*.

### Vault reference layer consulted

*(Design-time, read-only, one-way — `adr:bonded-pair-division-of-labor`, draft.)*

- `concepts/camera-program.md` — AI/04's parent. Bulletins are numbered-point dossiers
  (AI/02 = the NASA-grade SE dossier; AI/03 = the Playhouse foundation document). **Gap G-06**
  records that the Bulletin lineage is absent from code.
- `concepts/precedent-survey-methodology.md` — the corpus law **"never blend at the source"**
  independently forbids merging AI-posture material into the existing craft lens.
- `concepts/lens-neistat.md` + `entities/van-neistat.md` — the existing pages are **design/craft
  axis only, with zero archived sources**, both seeded in a single commit (`d9daf0b`, the
  precedent-survey drain) and never fed since. This is the precise accretion failure the
  Destination is built to avoid; it is evidence, not background.
- `concepts/cognitive-debt.md` — Neistat's failure report is the attention-side analogue of
  self-concealing debt: the cost charges nothing while things work.
- `synthesis/hal-creative-stubs.md` — the latent Curtis artifact (see the fork stub).

### Disclosure seam (ruled 2026-08-08)

`ojfbot/core` is **public**; `ojfbot/selfco` is private. The charting session held projection
because `camera-program.md:65` carries an open question about whether the Camera Program and the
Bulletin lineage should be publicly visible at all (G-02/G-05/G-06).

**The evidence that settled it:** the seam is already crossed and pushed. Commit `4769373` put
`.claude/skills/speculative-pass/knowledge/stance-generation.md` in the public repo naming *"the
Airstream camera program + analog fabrication (intaglio / cyanotype / pinhole)"* and instructing
agents to retrieve the operator's known world *"from selfco."* `decisions/northstar/offsite/`
names the Camera Program's mission ladder. Not public anywhere: the **Bulletin lineage**, the
**Belger Tolerance Ladder**, and **CMDR PLUMB** (zero hits each).

**Ruling (operator, 2026-08-08):** this map lives in public core at charted resolution — the
single map library is load-bearing (any surface enumerates every open frontier in one read, which
a relocated map would break, taking this initiative out of `/frame-standup` and the cockpit). The
Camera Program and Bulletin lineage going public here is a modest step up from what is already
pushed. **One carve-out:** the subscription-side capture-fidelity ruling is pointered, not
restated, and lives in the private vault. Reason — this map's own fog includes approaching Neistat
directly, and a publicly indexed, attributable record of how his paid material is captured is a
poor artifact to have standing behind that approach, independent of it being personal-use and
privately stored.

This ruling covers **this map only**. It does not close `camera-program.md:65` — the READMEs
question (G-02/G-05) is untouched, and remains the vault's to answer.

## Decisions so far

- Map lives in public core at charted resolution; the seam was already crossed by commit `4769373`.
  Subscription-side capture fidelity is pointered, not restated, to protect the future approach to
  Neistat — **Disclosure seam: does this map live in public core?** (#423, closed 2026-08-08)
- Tracker splits in two: the Pi lands RSS items into `raw/inbox/` **LLM-free** (no key on the
  always-on box, current posture preserved), and a separately scheduled Routine drains
  `raw/inbox/` into `wiki/` with relevance tagging. Both halves are roadmap slices, not tickets.
  The relevance *rule* waits on #429 — the filter's criterion doesn't exist until the thesis does
  — **Which scheduler owns the standing tracker?** (#426, closed 2026-08-08)

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Disclosure seam: does this map live in public core? (#423) | grilling | — | **closed 2026-08-08** |
| Stand up the Neistat capture: RSS backfill + subscription-side archive (#424) | task | — | open — **frontier** |
| Extract Neistat's AI position from the primary corpus (#425) | research | Stand up the Neistat capture | open |
| Which scheduler owns the standing tracker? (#426) | grilling | — | **closed 2026-08-08** |
| Can Patreon be captured on a schedule without a human session? (#427) | prototype | — | open — **frontier**, unblocked by Which scheduler |
| Does Neistat get a new lens, and on which axis? (#428) | grilling | Extract Neistat's AI position | open |
| What is Bulletin AI/04's thesis and form? (#429) | grilling | Extract Neistat's AI position | open |
| What is the bulletin-relevance filter? (#430) | grilling | What is Bulletin AI/04's thesis and form | open |

## Not yet specified

*In-scope fog — belongs to the Destination, but the question cannot yet be stated precisely.
Reviewed every work session; graduates when the question (not the answer) becomes statable.*

- **Contacting him.** The operator named this as an eventual want. The question isn't statable
  until AI/04 exists — what you'd send, and why it would be worth his time, are both functions of
  the artifact. Graduates once "What is Bulletin AI/04's thesis and form?" closes.
- **The analog pipeline.** Building your own Johnny 5 / Van Squared — a local model labeling and
  searching the Hal archive (~172G), the ChatGPT archive, and the bldgblog corpus. Whether this is
  a deliverable of the practice or merely a thing he did depends on what AI/04 claims. Note: when
  it graduates it is likely a **roadmap slice, not a ticket** (a machine-runnable check exists).
- **Closing gap G-06.** Whether the Bulletin lineage gets a code surface (the Bhardwaj dossier's
  proposed "Frame OS Bulletins" channel in BlogEngine, R-5). Entangled with the disclosure seam.
- **Matthew Crawford.** *Shop Class as Soulcraft* is the source of "the spirited man" and sits
  directly on the craft/AI axis. Whether he needs a node, and whether he belongs to this map or the
  Curtis fork, is not yet statable.

## Out of scope

- **Adam Curtis as a charted node** — ruled by the operator, 2026-08-08: fork it out, spin
  dedicated sessions.

  *Fork stub (for the future Curtis map).* Curtis is the critical spine of Neistat's AI argument:
  "the machine dream was never real" restates *All Watched Over by Machines of Loving Grace* — that
  the self-balancing-ecosystem premise under Silicon Valley was always a projection of how machines
  are organized, never how nature works. He is also **already latent in the vault, unnamed**:
  `synthesis/hal-creative-stubs.md:46` records `058-health-insurance-evolution-story.txt`
  (Feb 2024) as an *"Adam Curtis-style 30-second narration script"* for *Dallas & The Invention of
  Healthcare*, and line 64 flags it as one of the archive's **smallest resumable units** — a
  finished voice artifact awaiting an existing logline. A Curtis map would need to cover: the
  documentary method as a reusable register for the alternate-Americas / Dallas work; corpus scope
  (*All Watched Over…*, *HyperNormalisation*, *The Century of the Self*, *Bitter Lake*, *Can't Get
  You Out of My Head*, *TraumaZone*); and whether Curtis becomes a precedent-survey lens on the
  Output axis. Curtis currently has **no entity page** in the vault.
