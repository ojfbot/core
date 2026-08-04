# Core principles

The depth model behind `/deepen`. Load before measuring or proposing.

1. **Depth = interface simplicity × implementation richness.** A deep module has a small, stable public surface and rich, valuable internal logic. A shallow module is the opposite: many tiny exports each doing very little, requiring callers to assemble the meaning.
2. **Few deep modules > many shallow ones.** Cognitive load tracks number-of-modules-touched, not total LOC. Consolidating five thin wrappers into one substantial module is usually a win.
3. **Don't deepen what doesn't ask to be deepened.** Modules that are stable, well-tested, and comfortable to read are fine even if they look thin on metrics. Shallow + painful to work with = candidate. Shallow + invisible = leave it.
4. **Refactors crossing package boundaries need an ADR.** The blast radius is too large to do silently.
5. **No edits in default mode.** This skill produces proposals, not patches. `--apply` requires explicit user approval per proposal.
