Reference for `selfco-ingest`: the vault/pipeline architecture, the trigger list, the four modes in full, per-source fetch handling, the discussion step, and worked examples.

James runs a personal Obsidian vault at ~/selfco/ modeled on Karpathy's LLM Wiki pattern: raw/ for immutable sources, wiki/ for LLM-generated pages (sources/, entities/, concepts/, synthesis/), and CLAUDE.md as the schema. Because Claude chat (web/mobile) can't write to his network, all writes flow through a Notion inbox database (Inbox under selfco — Inbox). A local promoter on his network polls or webhook-receives status=ready rows and lands them in the vault with proper frontmatter, then commits to GitHub as a mirror.

When this skill triggers

- A URL appears in chat with no other context (default: ask which mode)
- Explicit ingestion phrases: "ingest this," "save this for selfco," "add this to the vault," "this is for selfco," "drop this into selfco"
- Explicit session-handoff phrases: "fold this conversation into selfco," "save this session," "handoff to selfco," "selfco this whole thread," "make a note of this conversation"
- Discussion invitations alongside a URL: "let's talk about this video," "what do you make of this?"
- A pasted YouTube transcript or article body without an obvious destination
- "Read this and tell me what to think about it" — discussion mode with a source

Four modes

Discuss. Fetch the source, summarize briefly, surface the most interesting threads, react to what James says. Don't write anything to Notion yet. Default for ambiguous URL drops.

Stage. Build the structured source page (template below), write it to the Notion inbox. The box files any non-terminal row within ~5 min — there is no `draft` hold (ADR-0073), so finish the body *before* you create the row. The promoter lands the file and flips the row to `promoted`.

Combined. Discuss first, then offer to stage at a natural moment. Capture both the source and the discussion thread in the staged note. This is the workflow that benefits most from the deep-linking step — the connections only surface when James reacts.

Session. No external source — fold *this whole conversation* into the inbox. Used when the discussion itself is the artifact, or when a chat produced drafts/code/plans/research that should land in the vault even though no single URL kicked it off. Same staging mechanics as Stage; the body is shaped as a session bundle rather than a source page (see "If the capture is a session, not a source" under workflow §4). Default to this mode when the user says "selfco this" after a substantive conversation with no canonical source.

If unsure which mode is intended, ask once: "Discuss, stage, combined, or session?"

1. Fetch the source

- YouTube: web_fetch the URL. If the page yields captions or a transcript, use them. Don't attempt audio transcription. If captions aren't accessible, ask James to paste the transcript — or proceed without on title/description alone, but flag the limitation.
- Article / blog post: web_fetch the URL. Extract title, author, publish date, body. Ignore sidebar/footer boilerplate.
- Paper: web_fetch the PDF or HTML landing page. Extract title, authors, abstract, key claims.
- Podcast: ask for show notes or transcript URL. Same handling as YouTube.
- **Session mode: skip this step.** There is no external source to fetch. Go straight to §2 (the discussion *is* the source) or §4 (if discussion already happened).

2. Discuss (always — even in stage mode)

Open with a 2–3 sentence framing of what the source argues. Don't restate the whole thing. Highlight parts James probably cares about given his @ojfbot work — assistant-centric architecture, classification systems never being neutral, Cozy Beaver, Frame ecosystem, Gas Town/Wasteland, agentic orchestration, Deakins-aesthetic interests. Wait for him to react before proceeding. The discussion is where deep links surface.

Examples

Ambiguous URL drop
James: https://youtube.com/watch?v=abc123
Claude: [fetches the URL] "That's the Team Deakins ep on 1917's one-shot logistics. Discuss, stage, combined, or session?"

Stage-only
James: "save this for selfco — https://karpathy.bearblog.dev/llm-wiki/"
Claude: [fetches → builds the source page → stages to inbox] "Staged as karpathy-llm-wiki, 720 words of summary in the body. Suggested wikilinks: [[Andrej Karpathy]], [[LLM Wiki]], [[Obsidian]], [[Vannevar Bush]], with a connection to [[Frame]] worth surfacing. It files within ~5 min; watch for status=promoted: <url>."

Combined discussion → stage
James: "let's discuss this — <article URL>"
Claude: [fetches → opens with framing → discusses] ... after a few turns: "Stage what we just covered? The Gas Town execution-plane vs Frame experience-plane connection isn't in the original article, but it surfaced here and is worth keeping in the discussion thread."

Session
James: "fold this conversation into selfco"
Claude: [reviews the conversation, identifies topics, drafts, decisions] "Staging as session-2026-05-15-frame-shell-architecture-rethink, 840 words of summary covering the TL;DR / Key points / Decisions / Open questions / Discussion thread, plus the two drafts we worked on (Frame shell adapter spec, beaverGame portal sketch) included verbatim under Artifacts. Tags: selfco, frame, architecture. It files within ~5 min; watch for status=promoted: <url>."
