---
id: 20260802-2320-discovery-accelerator-portal-syllabus-differs-from-public-page
type: discovery
title: "Newline Accelerator portal syllabus (17 units + Harness Engineering) differs materially from the public Power AI page; Unit 5 mini-projects = the two artifacts already on disk"
actor: code-claude
session_id: fde-skills-audit-2026-08-02
refs:
  - bead:20260802-2145-report-fde-skills-audit-curriculum-map-k-offer-roadmap-shipped
  - file:personal-knowledge/fde-job-target.md
hook: "github:ojfbot/core#319"
status: closed
created_at: 2026-08-02T23:20:00-0500
labels:
  project: fde-operating-presence
---

## Discovery

Authenticated portal exploration (community.newline.co/ai-bootcamp-7342/courses, operator's own
session) shows the **real Accelerator syllabus is 17 units + a standalone "Harness Engineering"
course** — the public Power AI course page (11 builder-track modules: Bolt/Supabase/Netlify/n8n)
is a different, thinner program and was the wrong ruler for the curriculum map. The curriculum
section of `personal-knowledge/fde-job-target.md` was rewritten from portal ground truth.

Load-bearing specifics:

1. **Unit 5's mini-projects are exactly the two artifacts already on disk**: Mini-Project 1
   "Home DIY Repair Q&A Synthetic Data Generator" (= public repo `diy-repair-qa-eval`) and
   Mini-Project 2 "AI-Powered Resume Coach: Synthetic Data Pipeline" (= `newline-ai-course/
   resume-builder/`). Both can be formally completed/submitted with near-zero new work.
2. **A "Harness Engineering" course exists** — "Building Professional Coding Agents," harness
   anatomy *using Claude Code as the primary example* (tools/MCP/skills/subagents/verification,
   checkpointing), plus DSPy prompt-optimization/eval pipelines and "career evidence portfolio"
   coaching. Maps 1:1 onto the fleet's deepest existing competence.
3. **Unit 16 (AI Career Path) portfolio doctrine: "8 mini-projects + 1 deployed system"**, a
   90-day shipping/practice/outreach plan, and an interview resource pack (LLM/agent interview
   guides, rubric scoring, Chip Huyen / Raschka / Alammar reference library). Converges with the
   roadmap's moves 1–2.
4. Genre verdicts vs the first mapping: G1/G2/G6 coverage stronger than the public page implied
   (G2 notably via Harness Engineering); **G3's consultative core, G4, and G5 remain untouched**
   — confirmed against the real syllabus, not inferred.
5. Mechanics for future sessions: course lesson bodies are enrollment-gated (enrolling is free
   within the membership, no payment step); page text is best extracted via accessibility tree
   or heading/list DOM queries — `get_page_text`/`innerText` return empty on this SPA, and raw
   `textContent` dumps trip the DLP filter. Live-lecture recordings ran on a 2/19–6/4 cadence
   (cohort content is recorded, not upcoming).
