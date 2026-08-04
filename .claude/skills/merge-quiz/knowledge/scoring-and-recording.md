Reference for `/merge-quiz` steps 5–7: the scoring report template and verdict ladder, the vault capture command and deposit format, and the heatmap record commands — in full.

### 5. Score

Per question: **1.0** correct and complete · **0.5** right instinct, missing the mechanism · **0.0** wrong or "don't know".

Score the *understanding*, not the phrasing. A correct answer in sloppy words is correct. A fluent answer that misses the mechanism is 0.5 at best.

Report:

```
## Quiz result — <repo> / <PR or branch>

**Score: <n>/5 (<pct>%)** · mode: `taught` | `cold`

| # | Facet | Verdict | What was missed |
|---|-------|---------|-----------------|
```

Then the honest verdict — and with every verdict, the remedy:

- **100%** — merge. The understanding is there.
- **60–99%** — mergeable. Name the specific gap and the one file to read first.
- **<60%** — say plainly: *this change isn't understood well enough to merge yet.* Do not soften it, and do not merge on the user's behalf.

A verdict without a remedy is the failure mode this skill was rewritten to fix. Every run — including a 100% — ends with:

**What to do next**
- the **one file** to read, and what to look for in it;
- the **one question** worth asking the author (or the agent) about this change;
- if <60%: an offer to walk the riskiest mechanism in depth, right now.

Score the answers they gave, not the answers they'd give after your explanations. The teaching does not retroactively raise the number — that would make every score a 100% and the heatmap worthless.

### 6. Capture what was learned into the vault

The quiz just produced the single most depositable artifact in the harness set: an explanation
of a mechanism the user did not know, written at the exact moment they found out they didn't
know it. That is deposit-library material, and before this step it evaporated when the turn ended.

**Deposit the gap, not the transcript.** Capture only the questions scored below 1.0 — the
mechanism that was missed, and the explanation that closed it. A question answered correctly
teaches nobody anything later; depositing it bulks the vault with confirmations of what the
user already knew, which is how a knowledge base becomes a log nobody reads.

**Skip the capture entirely on a clean sweep.** If every answer scored 1.0, say so and write
nothing. An empty deposit is the right output.

Compose the block, then pipe it in:

```bash
cd ~/ojfbot/core && node scripts/hooks/merge-quiz.mjs --capture \
  --repo=<repo> --domain=<subsystem> --score=<0-100> --mode=taught|cold [--pr=<N>] <<'EOF'
**Gap:** <the mechanism the user did not have — one line, stated as a fact about the system,
not as a fact about the user>

**Mechanism:** <what actually happens, concretely, citing `file:symbol`>

**Why it matters:** <what breaks, what it costs, what it protects>

**Generalizes to:** <the transferable rule, if there is one — the reason this is worth keeping
beyond this PR. If it doesn't generalize, say "specific to this change" and keep it short.>

Links: [[<entity-or-concept>]] [[<other>]]
EOF
```

On wikilinks: propose `[[…]]` for pages that plausibly exist or should exist, and don't
agonise — an unresolved link is a valid marker of something worth writing, not an error. Prefer
linking the **repo entity** (`[[core]]`, `[[morning-cockpit]]`) and the **concept**, not the PR.

This appends to `~/selfco/wiki/log.md`, the vault's append-only ledger — the same seam
`vault-session.sh` uses. It does **not** write wiki pages: `/vault` owns those, and folding the
deposit into `concepts/` or an entity page happens on the next `/vault sync`. Writing pages
directly from here would bypass the vault's schema and its link discipline.

If the vault ledger doesn't exist, the command no-ops with a message. Don't treat that as a
failure and don't fall back to writing somewhere else.

### 7. Record

```bash
cd ~/ojfbot/core && node scripts/hooks/merge-quiz.mjs --record \
  --score=<0-100> --repo=<repo> --domain=<subsystem> --questions=5 \
  --mode=taught|cold [--pr=<N>] [--human-delta=true]
```

`--mode` is required and must reflect what actually happened: `taught` if Step 2 briefed them, `cold` if `--cold` skipped it. The heatmap keeps the two apart, because a briefed 80% and a cold 80% are different facts about the same person.

Set `--human-delta=true` only if the quiz actually changed something — the user re-read code, fixed a defect, revised the change, or held the merge. If the answer is "they scored well and merged anyway", it is `false`, and that is the honest record.

`node scripts/hooks/merge-quiz.mjs --report` rolls these into the comprehension heatmap by repo × domain. **A falling cell is where to re-engage.** If a repo's comprehension trends down while work keeps landing there, the acquisition thesis for that domain is failing measurably — which is the whole point of having a number instead of a feeling.
