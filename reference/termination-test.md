# The termination test — a three-question diagnostic for planning systems

Desk copy for lesson `0001-the-termination-test.html`. Markdown, not HTML, so it renders where it
is kept ([[teach/index]] is in the vault, and Obsidian will not render a standalone `.html`).

**Provenance caveat, carry it when you use this:** the three questions are *not* Ryan Singer's
framework. They are assembled from Shape Up §1.2, §2.2 and §3.5 to serve one mission. Presenting
them as "Shape Up's diagnostic" overstates the source.

---

## The three questions

**Q1 — What is fixed, and what floats?**
Time, scope, quality — which one does the system refuse to negotiate?
> "Estimates start with a design and end with a number. Appetites start with a number and end with
> a design." — §1.2

**Q2 — What makes work stop, other than being finished?**
Most systems have no answer. That *is* the answer; write it down rather than glossing it.

**Q3 — On overrun, what is the *default*?**
Not what is permitted — what happens when nobody argues. Defaults are the real policy, because
they are what happens under fatigue.

---

## Answer key: two systems

| | Shape Up | Control-Gated Slices (ADR-0086) |
|---|---|---|
| **Q1 fixed** | Time (the cycle) | Scope + quality (Success Criteria as TPMs) |
| **Q1 floats** | Scope — cut until it fits | Time — a slice waits until TPMs clear |
| **Q2 stop rule** | Cycle boundary + compare *down to baseline* | TPMs clear → RIDM promotion |
| **Q3 on overrun** | **Cancel by default**, return to shaping | **Nothing** — elapsed time is not a gate condition |
| **Q3 on breach** | (not modelled — no measurement layer) | Stay in Brassboard, corrective action, re-sample |

**They are duals.** Same unit of work (the vertical slice), opposite fixed variable. Practical
consequence: importing "appetite" onto a slice while keeping TPM-gated promotion yields work that
is time-boxed *and* quality-gated with no rule for which yields. Any adoption must say which
variable floats.

**The distinction that is easy to lose:** CGS *does* have a stopping rule — for measurement
**breach**. It has none for **time overrun**. "The fleet has no circuit breaker" is precise, not
sloppy.

---

## Shape Up's circuit breaker, stated properly

Default: a project that runs past its cycle is **cancelled** and returns to shaping — it does not
buy time. Two conditions permit an extension anyway (§3.5, "When to extend a project"):

1. The remaining work is true **must-haves** that survived every attempt to scope-hammer them.
2. All remaining work is **downhill** — no unsolved problems, no open questions.

Uphill work at the deadline is read as evidence that the **shaping** was wrong, not that the team
was slow. The exception is a diagnostic that routes failure to the right place, not a loophole.

Three stated effects (§2.2): caps runaway investment · routes overrun back to shaping rather than
to more execution · creates the pressure that makes scope-cutting rational.

---

## The adoption guard

> **Does the problem the mechanism solves exist here, independent of the source?**

If the only evidence you need it is that Basecamp found it useful, you are copying a shape. If you
can point at your own overruns *first* and reach for the mechanism *second*, you are absorbing.

The trap is that a mechanism can be genuinely good **and** genuinely wanted while the adoption is
still hollow. The tell is the order of the evidence, not the quality of the idea.

Local evidence, for the record: slices flipped `ready` that stay open · 28 open hooks · TD-006's
bead-ledger closure gap · S7–S18 invalidated awaiting replan.

Standing tension to resolve before adopting: the fleet's posture is **revive/seed, never demote**,
which is close to the circuit breaker's inverse. And the rule already exists here at a different
altitude — `draft-comprehension-heatmap-zpd-role.md` R5: *"A harness that is never invoked is
theatre with a log file, and retiring it is the loop working."* The live question is therefore not
"should we adopt this?" but "why does it only apply to harnesses?"

---

## Related

- [[sources/shape-up-ref]] · [[concepts/appetite]] · [[concepts/circuit-breaker-shape-up]] ·
  [[concepts/shaping]] · [[control-gated-slices]]
- [[synthesis/shape-up-vs-control-gated-slices]] — the long-form comparison (prior output, not a
  source for this lesson)
- Go deeper, one chapter: **§3.5 Decide When to Stop** — https://basecamp.com/shapeup/3.5-chapter-14
