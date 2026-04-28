# Decision-tree method — walking dependencies between decisions

Most non-trivial work is a tree of decisions, not a flat list. Decision A constrains B; B constrains C. If you ask C in a vacuum, C's answer is unstable — it'll flip when A is decided.

Walk the tree top-down: root question → branches → leaves.

## Sketching the tree

Before grilling, write down (in your head or on screen) the 3-7 decisions this work depends on. Connect parents to children: "if A is X, then B becomes a non-issue; if A is Y, B is forced to Z."

Example — "add session resume to cv-builder chat panel":

```
Root: where does session state live?
├── Server-side (DB / file)
│   ├── Per-user or per-thread?
│   ├── Eviction policy?
│   └── Auth: how do we identify the resuming session?
├── Client-side (localStorage / IndexedDB)
│   ├── Encryption?
│   └── What happens on device switch?
└── Hybrid (cache locally, sync to server)
    └── Conflict resolution?
```

The root question is *"where does state live?"* — its answer obsoletes most of one branch. Ask it first.

## Identifying the root

A root question:
- **Has high leverage**: its answer flips multiple downstream branches.
- **Is independently decidable**: can be answered without depending on a deeper question.
- **Has irreversible consequences**: the choice is hard to undo without rewriting.

If a question has all three, it's a root. Ask it first.

If a question has none of three, it's a leaf. Don't ask it until the relevant branch is settled — otherwise the answer is provisional.

## Walking the tree

After each answer:
1. **Prune** — eliminate branches the answer rules out.
2. **Promote** — the highest-leverage remaining question becomes the next root.
3. **Update CONTEXT.md** — if the answer introduced a new term or revised an existing one.
4. **Decide whether to keep grilling** — if all remaining questions are leaves with low independent leverage, you have enough to write the design concept. Stop.

## When the tree is unclear

Sometimes the user's request is so vague that you can't sketch the tree. In that case:
- Ask one *very* high-level intent-shaping question first ("what are we even doing?").
- The answer will let you sketch a tree.
- Then return to the tree-walking pattern.

## When branches feel equally weighted

If two branches look equally important and you can't pick a root:
- Ask both in *one* combined question, naming them: "Two roads — A or B. Which?"
- This is the only time it's correct to ask multiple things in one turn. The questions are dependent siblings, not independent.

## When the user picks a leaf instead

If the user answers something deeper than your root question (jumps three levels in), respect it. Their answer probably constrains the upstream decisions. Restate: "OK — if you want C, that means we're committing to A=X. Is that the call you want?"

Often the user has already decided the parent without saying so. Confirm and move on.

## Output: keep the tree visible

In the grill output, show the tree (small ASCII or bullet hierarchy). The user can spot a missing branch faster than they can spot a missing question. Visibility forces precision.

Once you've walked the tree, the final design concept paragraph should mention each decision the user made and which branch was taken.

## Anti-pattern: the depth-first dive

Going deep down one branch before all root-level branches are settled. The user agrees to A=X, you immediately ask about A.B.C., never come back to root question Y. Result: half the design is over-specified, the other half is underspecified.

Stay breadth-first at the top. Go depth-first only after the top is settled.
