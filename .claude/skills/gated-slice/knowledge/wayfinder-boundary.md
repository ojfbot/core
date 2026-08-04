# Upstream boundary — wayfinder vs gated-slice

Reference for `/gated-slice`, moved verbatim from SKILL.md: when the initiative still needs charting before slicing.

- **Upstream boundary** (`adr:wayfinder-decision-maps`): this skill assumes the destination and route
  are already *decided*. If the open question is still *what/whether* — the initiative is wrapped in
  fog, decisions interdependent and unmade — chart it with `/wayfinder` first; hand back here when
  nothing is left to decide. Rule of thumb: *what/whether → wayfinder; how to ship safely in stages →
  gated-slice; once sliced → roadmap slices dispatched by day-run.* Wayfinder tickets are questions
  closed by answers; the slices this skill cuts are deliveries closed by merged PRs.
