Reference for `/bead`: inventory of the files shipped in this skill.

## Files in this skill

- `references/bead-schemas.md` — frontmatter schema per bead type
- `references/session-protocol.md` — orient → work → handoff in detail
- `references/gas-town-compatibility.md` — how this maps to bead/Gas Town/GasCity for downstream ingestion
- `templates/<type>.md` — scaffolding templates for each bead type
- `scripts/orient.py` — read recent beads, produce orientation summary
- `scripts/write.py` — scaffold a new bead from template
- `scripts/replay.py` — show timeline of beads since a date
