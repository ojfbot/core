# core — Object-Process Diagrams

> Rendered from `opm/system.opl` by `/opm render`. Do not hand-edit.
> Notation: rectangles = objects, rounded = processes, dotted `agent`/`instrument` edges = enablers.

## SD — core: the skill platform

```mermaid
flowchart TD
  Jim[Jim]
  ClaudeSession[Claude Session]
  ADR["ADR<br/>{draft, accepted}"]
  SkillCatalog[Skill Catalog]
  DomainKnowledge[Domain Knowledge]
  SkillTelemetryRecord[Skill Telemetry Record]
  InstallScript[Install Script]
  SiblingRepo[Sibling Repo]
  Skills[Skills]

  SkillInvoking(Skill Invoking)
  SkillSuggesting(Skill Suggesting)
  PromptSubmitting(Prompt Submitting)
  ADRAccepting(ADR Accepting)
  SkillInstalling(Skill Installing)

  Skills -- part of --> SkillCatalog
  Jim -. agent .-> SkillInvoking
  ClaudeSession -. agent .-> SkillInvoking
  SkillCatalog -. instrument .-> SkillInvoking
  SkillInvoking --> SkillTelemetryRecord
  SkillCatalog -. instrument .-> SkillSuggesting
  PromptSubmitting -. triggers .-> SkillSuggesting
  Jim -. agent .-> ADRAccepting
  ADRAccepting -- draft→accepted --> ADR
  InstallScript -. instrument .-> SkillInstalling
  SkillCatalog --> SkillInstalling
  SkillInstalling -- affects --> SiblingRepo
```

**OPL paragraph.** Jim is physical. Claude Session is physical. ADR can be draft or accepted.
Skill Catalog consists of Skills. Jim handles Skill Invoking. Claude Session handles Skill
Invoking. Skill Invoking requires Skill Catalog. Skill Invoking yields Skill Telemetry Record.
Skill Suggesting requires Skill Catalog. Prompt Submitting triggers Skill Suggesting. Jim handles
ADR Accepting. ADR Accepting changes ADR from draft to accepted. Skill Installing requires
Install Script. Skill Installing consumes Skill Catalog. Skill Installing affects Sibling Repo.

## SD1.1 — Skill Invoking in-zoom

```mermaid
flowchart TD
  SkillCatalog[Skill Catalog]
  DomainKnowledge[Domain Knowledge]
  SkillTelemetryRecord[Skill Telemetry Record]

  SkillLoading(Skill Loading)
  SkillExecuting(Skill Executing)
  TelemetryLogging(Telemetry Logging)

  SkillCatalog -. instrument .-> SkillLoading
  DomainKnowledge -. instrument .-> SkillExecuting
  TelemetryLogging --> SkillTelemetryRecord
  SkillLoading --> SkillExecuting --> TelemetryLogging
```

**OPL paragraph.** Skill Invoking zooms into Skill Loading, Skill Executing, and Telemetry
Logging. Skill Loading requires Skill Catalog. Skill Executing requires Domain Knowledge.
Telemetry Logging yields Skill Telemetry Record.
