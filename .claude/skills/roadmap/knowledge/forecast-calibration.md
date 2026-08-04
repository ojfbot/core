# p(revise) forecast calibration

Extended calibration guidance for the per-item `p(revise)` forecast.

- **Coarse 0–20 scale** (0.00, 0.05, 0.10 … 1.00). Verbalized confidence clusters on a few round values whatever scale you offer, so finer buckets buy false precision.
- **Commit to a spread.** Tagging everything 0.5 minimises expected error while conveying nothing; a forecast that never discriminates is worse than none, because it passes for calibration. Score *reliability* and *resolution* separately (Murphy decomposition) — a good Brier score with flat resolution is exactly this failure hiding. See adr:harness-loop-instrumentation.
- Forecast the **decision**, not the difficulty. "Will this get changed?" ≠ "is this hard?"
