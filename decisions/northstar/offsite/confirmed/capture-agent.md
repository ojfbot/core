# Captured confirmed northstar — capture-agent (formerly gcgcca)

> **Formatted capture, landed.** Unlike shell/blogengine (chat wrote fenced blocks; landing HELD),
> the 2026-07-27 GOLF UMBRELLA sitting produced **prose vision briefs** and Code formatted +
> landed them 2026-07-30 (flow inversion, flagged). The canonical artifact is
> `capture-agent/.claude/northstar.md` (`l1-capture-agent`, registered); this file is the relay
> record. ⚑ = operator-verbatim. **Numeric targets are UNRATIFIED proposals.** v1.1 pins/cluster
> refs are per-policy stripped from the landed file and recorded here + in the evolution log.

```
CONFIRMED NORTHSTAR
app: capture-agent
schema: v1 (landed); intended cluster ref cluster-golf#P1 recorded in SYNTHESIS only (tier designed-not-built)
vision: ⚑ Scrape satellite data of all golf courses in Texas; use it as the initial training set for robust image classification, segmentation, and feature detection — mapping golf courses across seasons and drought conditions; produce ground-cover maps (tree coverage, turf, all site-survey layers); publish the fine-tuned model to Hugging Face as a portfolio artifact supporting the forward-deployed-engineer goal; then bring outputs into mirrorworld/fairway for 3D terrain. Producer role (USGS Earth Explorer acquisition) continues alongside — not a fold candidate, reaffirmed.
P1 | name: A fine-tuned golf-course model is published on Hugging Face | target: shipped model w/ card + eval (PROPOSED metric mIoU per class) + reproducible pipeline + licensing review | current: 0 | verification: HF model page URL, linkable in job applications | ladders_up_to: ns:l2-ojfbot#P1
P2 | name: The Texas golf-course corpus is scraped, multi-season | target: PROPOSED — operator to set (~850 TX courses ambition; documented v1 subset acceptable), incl. drought states | current: 5 | verification: corpus manifest; 5% = M2M path proven (459.5 MB download, PRs #3/#4), 0 courses multi-season | ladders_up_to: ns:l2-ojfbot#P1
P3 | name: The model is robust across seasons and drought | target: PROPOSED — eval across >=2 season/drought conditions per region; beats NDVI baseline on tree-vs-turf | current: 0 | verification: per-condition eval table + committed baseline comparison | ladders_up_to: ns:l2-ojfbot#P1
P4 | name: Model outputs feed the fairway digital twin | target: fairway consumes masks/features/seasonal variants for >=1 real course | current: 0 | verification: fairway scene traced to a model-version tag | ladders_up_to: ns:l2-ojfbot#P1
LADDER_STRESS: l2#P1=clean — PROPOSED by code-relay (briefs carried no verdicts; Q5): HF page = usable surface in its natural venue under venue-neutral P1 (rev 2026-07-23)
SYNTHESIS: Cluster first principle — feeds fairway (twin), golf-research (prediction-vs-ground-truth), golf-press (methodology), golf-runner (proof point). Fed by (future) hardware seed. Vault prior art binds: NAIP-CHM fastest canopy path; NDVI poor tree-vs-turf on courses. Intended cluster ref: cluster-golf#P1. ⚠ Overlap with mirrorworld P6/PH5 = open operator question Q3.
```
