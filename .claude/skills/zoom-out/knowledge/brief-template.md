# Zoom-out brief template

The one-screen context-briefing output format for Step 3.

```
## Zoom-out: <target>

**Lives in:** <package / bounded context>
**Role in the flow:** <one or two sentences — where this sits in the pipeline/graph/route>
**Called by:** <list of callers/importers>
**Depends on:** <key downstream things it relies on>
**Blast radius if changed:** <what breaks, how visibly>
**Governed by:** <ADR-NNNN / architecture doc, if any>
**If you need more:** <"run /recon for the full repo map" | "run /agent-debug for the graph" — only if warranted>
```
