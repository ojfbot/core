# Which established permission patterns are worth evaluating? (ojfbot/core#665)

Researched 2026-11-22 by session wf-permission-patterns. Research ticket. Discovery only.
**Nothing here is a decision. No framework is chosen.** This feeds #667 (where permissions are enforced).

## How to read this file

- **[S url]** = source-stated. The page or paper says it. I opened and read the text unless I say "abstract only".
- **[I]** = my inference. I am reasoning from sources. No source says it.
- Words follow the #663 rulings: *grant* is checkable authority; *re-delegation* is narrower-only; a *role* is an address only (so I write "RBAC role" when I mean the permission scheme); the *conductor* is named by the charter.
- Most 2026 papers are preprints. I could not check peer review. Single-author papers with small tests are marked.
- Quotes are short and attributed.
- This file builds on `prior-art.md` question 3. I do not repeat it. I add primary-source reading for MCP authorization, Cedar, OPA, SPIFFE/SPIRE, Biscuit, Macaroons, OAuth token exchange, and recent arXiv papers.
- This file is public-safe. It has no network details, keys, or personal information.

## What this fleet needs (the yardstick)

From the ticket background and the #663/#666 rulings. I use these to judge fit.

1. One owner, no second human. The owner's passkey-signed record (the charter) is the root of authority.
2. Services the owner runs: HelpDesk (signed relay) and FleetRunner (job queue with leases and fencing). Both are TypeScript services (HelpDesk source layout, checked in this repo).
3. Two Macs and a NAS. **The Mac is the real wall.** Any program running as the user can read all that Mac's keys (#666).
4. Re-delegation may only narrow. Budgets are shared across children (#663).
5. Needs: revocation, and audit records an agent cannot rewrite.

**What the Mac wall means for every pattern below [I].** If a program can read the session key, then any control whose secrets or rules the user account can read or write can be bypassed from that Mac. So a control helps in two ways only:
- It limits how much authority one stolen or injected session carries (smaller blast radius).
- It sits somewhere the Mac's user account cannot reach (a service the Mac does not control, or a root-owned setting).

## One-page comparison

| Pattern | What it enforces | Where it runs | Re-delegation, shared budget | Revocation | Audit |
|---|---|---|---|---|---|
| **A. Attenuating capability tokens** (Biscuit, Macaroons, agent "warrants") | A token carries its own limits; holders can only add limits | Check inside each service (needs only a public key for Biscuit) | Narrowing is built in and offline. A shared budget is **not** built in. | Short life, plus a revocation list pushed to services | Token does not record who narrowed it; service logs must |
| **B. Policy engine inside each service** (Cedar, OPA) | Allow/deny per request from rules written as data | A library or sidecar next to each service | Engine has no delegation chain of its own. Chain and counters are data you supply. | Remove the grant from the data the service reads | Built-in decision records |
| **C. Checkpoint outside the agent** (MCP gateway, local proxy, reference monitor) | Every tool call passes one checker | A separate process on the path | Whatever the checker implements | Cached authority at the checker is a known gap | One central log |
| **D. OAuth 2.1 + MCP authorization + token exchange** | Who the client is, which scopes, which audience | An authorization server plus each resource server | Exchange gives a new token; no link back; no budgets | Spec leaves propagation to the implementer | AS and RS logs |
| **E. Client-side rules on the Mac** (root-owned managed settings, OS sandbox, hooks) | What the agent program may run or reach on that Mac | Inside the agent's own machine | None | Edit the file | Local only |

## Shortlist: patterns worth evaluating (not chosen)

### A. Attenuating capability tokens

**What it is.** A signed token that lists what the holder may do. The holder can make a copy with more limits. Nobody can remove a limit.

**What I read.**
- Biscuit: the holder can add a block of checks that "reduce the token's scope" but cannot remove earlier blocks. Any verifier that knows the root public key can check it. [S https://raw.githubusercontent.com/biscuit-auth/biscuit/main/SPECIFICATIONS.md]
- Biscuit supports Ed25519 and secp256r1 signatures. [S same spec]
- Biscuit attenuation uses ephemeral key pairs that are destroyed after use. [S same spec] So the token does not record *who* attenuated it. [I]
- Biscuit has a sealed form that stops further attenuation. [S same spec]
- Biscuit's authorizer can add ambient facts such as the current time, and it generates a revocation identifier per block. [S same spec]
- Macaroons are bearer credentials built from chained HMACs; "caveats" narrow when, where, by whom and for what. [S https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/] Macaroons use a shared secret, so any verifier could mint. [S, as reported in prior-art.md from an IETF draft snippet; I did not re-open it]
- Agent-specific code exists. Tenuo (open source, Apache-2.0, announced by a single author, Rust core, Python and a beta TypeScript SDK) issues "warrants": signed grants with tools, argument limits and expiry. Delegation can only narrow. [S https://github.com/tenuo-ai/tenuo and https://news.ycombinator.com/item?id=46877029] The author's claims (about 27 µs per check) are the author's own and untested by me.
- Library status from the npm registry on 2026-11-22: Biscuit WASM 0.6.0, last published 2025-09-26; Tenuo TypeScript 0.3.6-beta.0 (2026-11-10); `macaroons.js` 0.3.9 (2020-11-21). [S https://registry.npmjs.org/]
- The Biscuit README says it is still "looking for an audit" of its design and implementations. [S https://raw.githubusercontent.com/biscuit-auth/biscuit/main/README.md]
- Research: CAPMAS uses Macaroons for offline, shrink-only delegation between agents. It claims 30 times faster delegation than OAuth token exchange. [S abstract only: https://arxiv.org/abs/2609.06500; authors' own claim]
- Research: AgentCap issues "short-lived, budget-bounded capability tokens" and says budget and lifetime "can only be attenuated". [S abstract only: https://arxiv.org/abs/2611.00729] The abstract does not say whether siblings share one budget.
- Research: DelegateGuard turns the initiating user's authority into attenuable capabilities with "revocation cascades through the delegation graph". It uses a reference monitor, i.e. a stateful checker. [S abstract only: https://arxiv.org/abs/2610.16005]

**Where it runs.** In each service that checks a token. A service needs only the root public key. [S Biscuit spec] [I] That fits services on the NAS verifying a token chain that starts at the owner's charter.

**Cost.**
- Token libraries are small. Checks are fast. [I] Speed is not the problem at this scale.
- Real costs: an issuer that can mint tokens from the charter, key handling, and a way to push revocation lists. [I]
- Library maturity is thin: the Biscuit WASM package has had no release for over a year; Tenuo TypeScript is beta. [S npm registry above]

**Failure modes and attacks.**
- Same-process enforcement does not stop an untrusted agent. Tenuo's own README says enforcement "must run at a boundary the agent cannot modify or bypass". [S README] So the check has to be in the service, not in the agent's runtime.
- Bearer tokens can be stolen. Tenuo adds proof of possession, but its security notes say a valid signature can be replayed inside a window of about two minutes unless you keep a nonce store. [S https://raw.githubusercontent.com/tenuo-ai/tenuo/main/docs/security.md]
- Offline checks cannot learn about a revocation they have not received. [S Tenuo README]
- Argument limits must parse input the same way the target system does. [S Tenuo README, "constraint types"]
- Passing a secret as an ordinary argument to an allowed tool is a gap for per-call grants in general. [S abstract only: https://arxiv.org/abs/2606.29073]
- **Passkey fit is unproven. [I]** A passkey signs a challenge in the WebAuthn format. It does not sign arbitrary token bytes in Biscuit's own format. A service would likely verify the charter signature, then mint the root token itself. Whether that keeps "the owner signed it" checkable by a receiver is a design question I could not settle from sources.

**Re-delegation and shared budgets.**
- Narrowing: strong. Tokens enforce "subset of tools, tighter limits, no longer life" offline. [S Tenuo security notes, "Monotonic Attenuation"]
- Shared budgets: **not solved by the token.** Tenuo's own table puts task budgets in "Application / In-memory" and hard call limits in "Gateway rate limiting / Stateful". [S Tenuo security notes] [I] A budget shared by several children needs one counter held by a service. FleetRunner's leases and fencing may be the natural home, but that is my inference.

**Revocation.** Prefer short life over revocation: Tenuo recommends warrant lives of 5–15 minutes, with signed revocation lists for emergencies. [S Tenuo security notes] Biscuit gives a revocation identifier per block. [S Biscuit spec]

**Audit.** The token shows what was allowed, not who narrowed it (see ephemeral keys above). [I] Audit must come from the service's own log, with the token's identifier in each record. Tenuo offers audit callbacks. [S Tenuo README]

### B. A policy engine inside each service (Cedar-class, OPA-class)

**What it is.** Rules are stored as data. A small engine answers "allow or deny" for each request.

**What I read.**
- Cedar asks "Can this principal take this action on this resource in this context?" The request context is a record the application supplies. [S https://docs.cedarpolicy.com/auth/authorization.html]
- Cedar's rules: default deny; any matching `forbid` beats any `permit`; a policy that errors is skipped. The docs explain the skip-on-error choice this way: with deny-on-error, one bad 101st policy could suddenly deny every request. [S same page]
- Cedar says policies of bounded size terminate and have no side effects, and that the engine has a Lean model and differential testing. [S https://docs.cedarpolicy.com/other/security.html]
- Cedar's docs put correctness of the policies on the user and say to be careful who may change policies. [S same page]
- The npm package `@cedar-policy/cedar-wasm` 4.15.0 was published 2026-11-16. [S npm registry] It runs inside a Node service. [I]
- OPA is a general policy engine that can run as a sidecar, a host daemon or a library. [S https://www.openpolicyagent.org/docs/philosophy]
- OPA decision logs record the policy path, the input, the result, a decision id and the bundle revision. They can be masked. [S https://www.openpolicyagent.org/docs/management-decision-logs]
- OPA's memory use scales with policy and data size; raw JSON data uses about 20 times more memory once loaded. A 1 ms decision budget is a documented design target. [S https://www.openpolicyagent.org/docs/policy-performance]
- OPA's WASM package last released 2024-11-08. [S npm registry]
- AWS offers Cedar-based policy at an MCP tool gateway. [S snippet only, from prior-art.md]

**Where it runs.** As a library or sidecar beside each service, so the service stays the last to decide. [I]

**Cost.**
- Cedar as a TypeScript library has a small footprint. [I] OPA means either a sidecar process or a WASM bundle. [S OPA docs]
- Real cost is writing, testing and versioning the rules and schema, and deciding who may edit them. [I] I found no cost figures for a one-person setup. This is the prior-art gap, still open.

**Failure modes and attacks.**
- The engine only sees what the service sends it. Wrong or stale input gives a wrong "allow". [S Cedar security page: users supply the data] [I]
- OPA decision logs include the input. LocalHelp's rule is to never log request bodies. [S OPA decision-log page; LocalHelp CLAUDE.md] Masking must be set up, or the log must be limited to identifiers. [I]
- A rule engine inside the agent's machine can be edited by the agent. Policies must live with the service, signed by the owner. [I]
- Rule drift when tool arguments change shape. [S prior-art.md, Cerbos post]

**Re-delegation and shared budgets.**
- No delegation chain is built in. A chain can be stored as entities or data, and the check "child is not wider than parent" has to happen when a grant is made. [I]
- Budgets: the engine is stateless; counters would be passed in as context or data. [I from Cedar PARC model and OPA data model]
- I did not verify whether Cedar has a tool that checks "policy X is no wider than policy Y". The Cedar security page mentions validation against a schema, not subset checks. [S] **Gap.**

**Revocation.** Remove the grant from the data the service holds. [I] It is as fresh as the service's copy. For OPA, the decision log records which bundle revision decided. [S OPA docs]

**Audit.** Good. Cedar returns the determining policies with each decision. [S Cedar authorization page] OPA gives a full decision log. [S OPA docs]

### C. A checkpoint outside the agent (MCP gateway, local proxy, reference monitor)

**What it is.** One checker that every tool call must pass. It sits outside the agent.

**What I read.**
- Kairos: a reference monitor at the isolation boundary reports attack success falling from 47.0% to 2.7% on one benchmark. [S abstract only: https://arxiv.org/abs/2610.18457]
- "Stop Means Stop": approval, cancel and timeout controls inside six agent frameworks did not act as barriers. The fix proposed is a gate outside the agent, valid only if every side effect passes it. [S abstract only: https://arxiv.org/abs/2607.14166]
- An independent gateway or server access list enforced the same invariants as an in-memory runtime in one benchmark. [S abstract only: https://arxiv.org/abs/2606.29073] [I] So the idea can sit in a service, not only a gateway.
- Revocation at gateways: delegated authority is cached at gateways. In the paper's fault test, when one receiver was cut off, transport acknowledgment and receiver persistence still succeeded, yet 112 of 225 calls (49.78%) were admitted. [S abstract only: https://arxiv.org/abs/2610.15991]
- Bypass paths: local stdio servers, direct remote URLs, personal tokens and unmanaged clients; some cannot be closed. [S, via prior-art.md: https://dev.to/speakeasy/what-is-mcp-gateway-bypass-33l9]
- Gateways cover MCP traffic only. [S, via prior-art.md: Security Boulevard article]
- An industry report describes one central gateway for authentication, grants and token exchange at a large organization. [S abstract only: https://arxiv.org/abs/2608.10760]

**Where it runs.** On the path between agents and tools. For this fleet there are two different cases, and they differ a lot. [I]
1. HelpDesk and FleetRunner already are the checkpoint for their own actions. A gateway in front of them adds a layer, not a new capability.
2. For actions that do not go through the owner's services (disk, git, shell, GitHub, network) there is no gateway today. A gateway for MCP does not reach those.

**Cost.** One more process to run and keep up. Fail-closed means a down checker stops work. Fail-open is a named risk. [S prior-art.md] I found no operating-cost data for one-person use.

**Failure modes and attacks.** The bypass paths above. Cached authority (revocation gap). One shared point of failure. A checker on the same Mac under the same user can be killed, edited or skipped by a program running as that user. [I]

**Re-delegation and shared budgets.** A central checker is where a shared counter would naturally live. [I] That is the one place the stateful patterns agree. DelegateGuard does revocation through a stateful monitor. [S abstract only]

**Revocation.** Immediate at the checker if the checker holds the state. Weak where it caches. [S 2610.15991 abstract]

**Audit.** One log of everything that crossed. It only records what crossed. [S Cerbos, via prior-art.md]

### D. OAuth 2.1 with the MCP authorization profile, plus token exchange

**What it is.** The standard way MCP clients and servers prove who they are and get scoped tokens.

**What I read.**
- The MCP 2026-07-28 spec: servers "MUST only accept tokens specifically intended for themselves", and must reject tokens that do not name them in the audience. [S https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations]
- Token passthrough is forbidden; the confused-deputy problem is named. [S same page]
- Scopes: a server can answer `insufficient_scope`, and the client may request a bigger scope ("step-up"). [S https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization]
- Over a standard-input (stdio) transport, implementations "SHOULD NOT" follow the spec and should take credentials from the environment. [S same page]
- RFC 8693 token exchange: one token is exchanged for another. The exchange "has no impact on the validity" of the input token and does not link the tokens. Propagating revocation is up to the implementation. [S https://www.rfc-editor.org/rfc/rfc8693.txt]
- RFC 8693's actor chain: earlier actors in nested `act` claims are "informational only" and not used for access decisions. [S same RFC]
- A sibling note in the shared notes folder (`research-oauth-mcp-spec.md`) already covers the registration and discovery details. I do not repeat them.

**Where it runs.** An authorization server plus a check in each resource server. [S MCP spec]

**Cost.** An authorization server to run, and client support that varies. Whether Claude Code and Codex CLI support the extensions the fleet would need is unverified in the sibling note. [S sibling note]

**Failure modes and attacks.** Token passthrough and confused deputy (named in the spec). Scopes are coarse. The actor chain is for information. No budget concept. [I from the RFC text] A stolen bearer token works until it expires, unless it is bound to a key; the sibling note on proof-of-possession covers that. [S sibling note `research-oauth-pop.md`]

**Re-delegation and shared budgets.** Each exchange is a new token request to the server. Whether the new token is narrower is the server's policy, not the protocol's. [I from RFC 8693 §2] CAPMAS claims this costs more than its Macaroon approach. [S abstract only; authors' claim] Shared budgets are not in the protocol. [I]

**Revocation.** Short token life. Revocation events are implementation-specific. [S RFC 8693]

**Audit.** The authorization server can log each exchange. The chain of earlier actors is not trusted by default. [S RFC 8693] [I]

### E. Client-side rules on the Mac (managed settings, OS sandbox, hooks)

**What it is.** The agent program's own permission rules, plus the OS sandbox it can run commands in. The fleet already has this in some form.

**What I read (Claude Code docs).**
- Managed settings sit at the top of the precedence order. "Nothing in your own settings files" overrides a managed key. [S https://code.claude.com/docs/en/settings]
- A deny rule blocks every matching call, even if a narrower allow rule exists. [S https://code.claude.com/docs/en/permissions]
- Switches such as `disableBypassPermissionsMode` are "most useful in managed settings where they can't be overridden". [S same page]
- The sandbox uses the macOS Seatbelt framework. It covers shell commands only. "Claude's file tools, MCP servers, and hooks run outside it." [S https://code.claude.com/docs/en/sandboxing]
- By default the sandbox lets commands read most of the machine, including credential files. [S same page]
- There is an unsandboxed retry escape hatch. In bypass mode it runs without a prompt. [S same page]
- Codex has two separate dials: a sandbox mode and an approval policy. [S, via prior-art.md: OpenAI docs]
- A research test found coding agents often edited "read-only" files anyway. Small samples. [S, via prior-art.md: LessWrong post]

**Where it runs.** On each Mac, in the agent's own machine.

**Cost.** Low. Per-machine configuration. [I] A root-owned file needs an admin to change it, which is the point. [I]

**Failure modes.**
- The sandbox does not cover file tools, MCP servers or hooks. [S sandboxing docs]
- A rule that the user account can edit is a rule the agent can edit. [I] Root-owned managed settings are the exception. How this works on the owner's setup (file location, MDM) was not tested by me.
- Different rules per client program (Claude Code, Codex). No shared view. [I]

**Re-delegation, budgets, revocation, audit.** None built in. [I] It limits what one machine's agent can do. It does not carry a grant between sessions or machines.

## Ruled out for now (and why)

| Pattern | Why it is not on the list | Basis |
|---|---|---|
| **SPIFFE/SPIRE workload identity** | Its model assumes each workload is "sufficiently well isolated" that another cannot steal its credentials. Your Mac is the case where that fails: one user, all keys readable. Its Unix attestation uses user id, group, binary path and hash. A program running as the same user shares most of those. It also adds a server with a signing key and a database, plus agents on each machine. The signed session keys you have already answer "which key signed". SPIFFE would not answer "who was acting" either. | [S https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/ ; https://spiffe.io/docs/latest/spire-about/spire-concepts/ ; https://github.com/spiffe/spire/blob/main/doc/plugin_agent_workloadattestor_unix.md] Fit reasoning is [I]. The 6–24 months figure from prior-art.md is vendor-written. |
| **RBAC role schemes** | #663 rules that a role is an address only. Authority comes from a grant tied to the session the charter names. Schemes where a role carries permissions conflict with that ruling. | [S #663 ruling] |
| **A standalone just-in-time credential broker** | The useful part is short life, and that is a property of A and D. A separate broker is one more service to protect and keep up. | [S Tenuo's 5–15 minute advice; prior-art.md CSA pattern] The "one more service" point is [I]. |
| **Provenance standards as a permission control** (W3C PROV, in-toto/DSSE) | They describe and record what happened. They do not decide what is allowed. No agent-specific standard exists. They belong to #668 (the evidence chain), not here. | [S prior-art.md Q6; W3C PROV overview] |
| **Insider-risk practice as a pattern** | It is practice, not a mechanism. Two ideas transfer. First, separation of duties: no one actor should complete a critical function alone, often called the two-person rule. [S CERT page] Second, the guide lists technical controls for it, such as two users approving a deletion of critical data. [S CERT page] The guide warns that collusion can defeat a two-person rule. [S CERT page] A search summary also said policy-only separation is easily circumvented; I did not find that sentence on the page I read, so treat it as unverified. For one owner, the owner's passkey approval could act as the second person. [I] | [S https://www.sei.cmu.edu/blog/separation-of-duties-and-least-privilege-part-15-of-20-cert-best-practices-to-mitigate-insider-threats-series/] Mapping to this fleet is [I]. |

Not examined (so not ruled in or out): relationship-based systems (Zanzibar-style, OpenFGA), agent-framework permission systems (LangGraph, OpenAI Agents SDK, CrewAI), IETF WIMSE delegation-chain drafts beyond what prior-art.md notes, NIST NCCoE concept paper.

## Findings that cut across patterns

1. **No stateless pattern enforces a shared budget by itself [I, supported by S].** Tokens (A) and policy engines (B) carry limits, not running totals. Tenuo's own docs say hard call limits are stateful and live in infrastructure. A shared budget needs a counter at a service that sees all children. [S Tenuo security notes; I for the general claim] This is a direct question for #667.
2. **Narrower-only is easiest to get from capability tokens, and easiest to bypass if the check runs in the agent's runtime [S Tenuo README; I].** The check must sit in a service the agent cannot edit.
3. **Revocation is the weak spot everywhere.** Short life lowers the exposure. Cached authority at a checker leaves a gap. [S 2610.15991 abstract; Tenuo notes] An earlier paper in the prior-art file argues that stopping a process does not stop authority already queued. [S prior-art.md, Zhu 2609.21284] FleetRunner's leases and fencing may bear on this. [I]
4. **Audit written by the agent is not audit.** Agents tampered with their own traces in most harnesses tested. [S prior-art.md, 2609.30266] So the service's own record is the audit that counts. [I] Both A and B depend on services keeping that record.
5. **No source describes any of these at one-person, multi-device scale.** [Gap, same as prior-art.md.] Fit for this fleet is my inference throughout.
6. **Agent prompts are not a barrier.** One paper finds labels inside a shared context are not an enforceable trust boundary and tests an external reference monitor. [S abstract only: https://arxiv.org/abs/2608.28502] This agrees with the fleet's own premise.

## Questions for #667 (the owner decides; I decide nothing)

1. Should a shared budget live in HelpDesk's journal, in FleetRunner's lease table, or somewhere new? Which service sees all the children?
2. Is a token the owner's grant, or does a service mint a token after it verifies the passkey-signed charter? (Passkey signatures do not directly sign a token's own bytes. [I])
3. Do you want grants to expire in minutes (renewal needs an issuer that is up), or last for the charter and be revoked on demand?
4. What should a service do when it cannot reach its rules or its revocation list: stop work, or keep the last known state? For which actions?
5. Which agent actions never touch HelpDesk or FleetRunner (disk, git, GitHub, shell)? Pattern E is the only one on this list that reaches them, and only on the Mac. Is that acceptable, or is a separate mediator needed there?
6. Should the checks use the same identity that signs requests today (device and session keys), or a separate grant key?
7. Does "separation of duties" for the conductor mean the owner approves every narrowing, or only the first grant?

## Gaps and what I could not verify

- **Reddit still fails.** Direct fetch returns 403 "Blocked". Search with `site:reddit.com` returned zero Reddit results; the engine returned vendor and blog pages. No Reddit thread is cited. I tried Hacker News through its public search API: it works. I read one Show HN thread (Tenuo). Hacker News is thin on this topic.
- **Papers read by abstract only:** CAPMAS, AgentCap, DelegateGuard, "Revocation Is Not Complete at Receipt", Kairos, "Stop Means Stop", 2606.29073, 2608.28502, 2608.10760, and "Authorization Architectures for Tool-Using AI Agents" (2609.15906). Their numbers are the authors' own and mostly from small or synthetic tests. The review paper 2609.15906 and the survey 2611.06764 (abstract read) may hold the best comparisons. Nobody has read their bodies.
- **Cedar:** subset or "no wider than" policy checks not verified. Official language-binding support beyond Rust and WASM not checked.
- **OPA:** I did not read how a sidecar behaves when it is down (fail-open or fail-closed). I did not test WASM use from TypeScript.
- **Biscuit and Macaroons:** The Biscuit WASM package's last release is over a year old. I could not tell if it is maintained. `macaroons.js` is dormant since 2020. Biscuit's revocation-list management in practice was not read beyond the spec. Macaroons "shared secret" point comes from prior-art.md.
- **Tenuo:** README and security notes read. I did not read the protocol spec, run the code, or find anyone outside the author using it. Single maintainer.
- **Managed settings:** the docs say a managed key cannot be overridden by the user's files. I did not test whether a user-run program on the owner's Macs can change the managed file.
- **Operating cost:** no source gives hours per month for a small fleet. My cost statements are [I].
- **Dates and IDs:** many arXiv IDs are newer than my training. Each was confirmed from a page load or the arXiv API; I could not cross-check against a second index.
- **Vendor bias:** gateway, SPIFFE and credential-broker material is mostly vendor-written. I flagged it where I could.

## Sources

Primary specs and official docs (read):
- MCP authorization 2026-07-28 and security considerations: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization ; https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations
- OAuth token exchange, RFC 8693: https://www.rfc-editor.org/rfc/rfc8693.txt
- Cedar: https://docs.cedarpolicy.com/auth/authorization.html ; https://docs.cedarpolicy.com/other/security.html
- OPA: https://www.openpolicyagent.org/docs/philosophy ; https://www.openpolicyagent.org/docs/policy-performance ; https://www.openpolicyagent.org/docs/management-decision-logs
- SPIFFE and SPIRE: https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/ ; https://spiffe.io/docs/latest/spire-about/spire-concepts/ ; https://github.com/spiffe/spire/blob/main/doc/plugin_agent_workloadattestor_unix.md
- Biscuit: https://raw.githubusercontent.com/biscuit-auth/biscuit/main/SPECIFICATIONS.md ; https://raw.githubusercontent.com/biscuit-auth/biscuit/main/README.md
- Macaroons (NDSS 2014 abstract page): https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/
- Claude Code docs: https://code.claude.com/docs/en/permissions ; https://code.claude.com/docs/en/settings ; https://code.claude.com/docs/en/sandboxing
- CERT separation of duties: https://www.sei.cmu.edu/blog/separation-of-duties-and-least-privilege-part-15-of-20-cert-best-practices-to-mitigate-insider-threats-series/
- npm registry entries for `@cedar-policy/cedar-wasm`, `@biscuit-auth/biscuit-wasm`, `@open-policy-agent/opa-wasm`, `@tenuo/core`, `macaroons.js` (queried 2026-11-22)

Project and practitioner (read):
- Tenuo: https://github.com/tenuo-ai/tenuo ; https://raw.githubusercontent.com/tenuo-ai/tenuo/main/docs/security.md ; https://news.ycombinator.com/item?id=46877029 (author's own post)

arXiv (abstract only unless noted):
- https://arxiv.org/abs/2609.06500 (CAPMAS) · https://arxiv.org/abs/2611.00729 (AgentCap) · https://arxiv.org/abs/2610.16005 (DelegateGuard) · https://arxiv.org/abs/2610.15991 (revocation at gateways) · https://arxiv.org/abs/2610.18457 (Kairos) · https://arxiv.org/abs/2607.14166 (Stop Means Stop) · https://arxiv.org/abs/2606.29073 (execution invariants in MCP-style runtimes) · https://arxiv.org/abs/2608.28502 (instruction self-arbitration) · https://arxiv.org/abs/2608.10760 (enterprise MCP gateway) · https://arxiv.org/abs/2609.15906 (authorization architectures review) · https://arxiv.org/abs/2611.06764 (access-control survey)

From earlier files (I did not re-open): `prior-art.md`; sibling notes `research-oauth-mcp-spec.md`, `research-oauth-pop.md`, `research-fleet-runner-auth.md`; #663 resolution note.
