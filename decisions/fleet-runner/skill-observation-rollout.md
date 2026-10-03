# Skill observation: fleet qualification and consumer rollout

Date: 2026-10-03 (America/Chicago). Status: Proposed; research and documentation only.
Initiative: [core #307](https://github.com/ojfbot/core/issues/307); follows
[#501](https://github.com/ojfbot/core/pull/501). This extends delivery slices 1–4,
especially slice 3, in the [existing handoff](skill-observation-delivery.md).
The [design](skill-observation.md) owns observation semantics and the
[correspondence profile](skill-observation-correspondence.md) owns report semantics.
This document owns the rollout evidence, distribution proposal and qualification cases;
it is neither another architecture nor a dispatch queue.

The operator authorized preparing this proposal and its review PR. No collector, export,
workflow, schedule, live qualification or consumer cutover is authorized by this record.
Implementation still requires approved scope, a named owner and registration in the
canonical roadmap. All criteria below are proposed unless explicitly marked as observed.

## Observed failure and current decision boundary

[Daily-logger PR #298's comment](https://github.com/ojfbot/daily-logger/pull/298#issuecomment-5970264401)
was created at 2026-10-03T14:49:22Z. Independent API readback returned the
`skill-audit-results` marker and the skipped-audit explanation.
[Run 37130992036](https://github.com/ojfbot/daily-logger/actions/runs/37130992036)
completed successfully for head `7450993682388f57ea68acb449bab6b74fa285b3`.
Its log shows `available=true`, the failed executable check, and the skip notices.
This establishes delivery of the placeholder, not a completed skill audit or consumption.

There is a material correction to the comment's explanation: at that PR head and inspected
main `75390193fc0415aebabb0ab34f1d6bf584b687f0`, the
[hook entry](https://github.com/ojfbot/daily-logger/blob/75390193fc0415aebabb0ab34f1d6bf584b687f0/scripts/hooks/pr-skill-audit.sh)
is **tracked**, mode `120000`, blob `058e7aadacdc61d69b0a51de86a1b9ee02728154`,
target `../../../core/scripts/hooks/pr-skill-audit.sh`. A consumer-only checkout has
no executable target. The general installation uses ignored local links, but the specific
remote failure is a dangling tracked link. Merely testing that a path is tracked is insufficient.

The current [workflow](https://github.com/ojfbot/daily-logger/blob/75390193fc0415aebabb0ab34f1d6bf584b687f0/.github/workflows/claude-skill-audit.yml)
clones core's `telemetry/daily`, suppresses clone/copy errors, and sets availability without
checking the copied files. It then exits zero on the unresolved hook and upserts a placeholder.
The upsert selects the first matching marker without publisher ownership or independent
readback. Neither a green job nor a downloaded branch demonstrates capture coverage.

Current policy was rechecked before drafting:

- #501 merged as `97e91dfa0a7aa75f096639840889499c8b521766`; its detailed contracts remain Proposed.
- #502 merged as `5abd7d6f7e843473dd30f3978452182955218c61`; its provisional Selfco loop-status
  adapter does not implement skill observation or qualify Codex skill capture.
- [#495](https://github.com/ojfbot/core/pull/495) merged as
  `bc6d120503416c9d21d627730f27f2d10cfc13f8`. Its
  [bounded correspondence ADR](../adr/draft-correspondence-speech-act-tiers.md) remains
  Proposed. D1–D12 changed meanings relative to the historical source pinned by #501.
  Human authority, identity/canonical state and a bounded operative profile remain undecided;
  D9 defers schema/tooling selection. Merge did not ratify #501's amendments.
- [ADR-0109](../adr/0109-fleet-runner-publication-hold.md) still holds the affected item
  against reassignment and conflicting publication while outstanding writes are unknown.
  Timeout, restart and one absent remote read do not release that hold.
- #308–#311, #313, #315–#318 and estate charter #279 were read and remain open.
  [The map](../wayfinder/control-plane-conductor.md) preserves their blocking edges.
  S23 is queued, S24 merged and S25 ready in the inspected
  [L2 roadmap](../northstar/roadmap-l2-ojfbot.md); this failure is follow-up evidence,
  not permission to rewrite their history or claim S25 delivered.

## Inventory evidence and denominators

Vantage: authenticated GitHub metadata/default-branch trees plus the operator Mac's
configuration and sibling remotes. Census completed 2026-10-03T15:04:17Z. Core baseline
is `bc6d120503416c9d21d627730f27f2d10cfc13f8`. Remote heads were pinned per repository;
this is an observation interval, not an atomic fleet snapshot. No raw session content was
exported. Private source access is not a grant to publish its telemetry.

The repeatable read procedure is: paginate `GET /user/repos?affiliation=owner&per_page=100`;
retain repository identity, visibility, archive/fork state and default branch; resolve each
head with `GET /repos/ojfbot/{repo}/commits/{default}`; inspect
`GET /repos/ojfbot/{repo}/git/trees/{head}?recursive=1`; read workflow blobs at their SHA.
All 56 returned trees were inspected, with zero API failures and zero truncated trees.
Inspect every workflow, not just a conventional filename; generic deployment telemetry
environment variables are not skill-reporting consumers. A future larger result must
paginate to exhaustion and treat truncation, lost private access or a missing page as a gap.

Reconcile this discovery against the existing
[fleet-manifest](../../scripts/fleet-manifest.mjs), northstar registry, committed
frame-standup list, local canonical remotes, and daily-logger's existing
[dynamic discovery](https://github.com/ojfbot/daily-logger/blob/75390193fc0415aebabb0ab34f1d6bf584b687f0/src/fleet.ts).
Registry entries describe meaning; they currently cannot supply the whole denominator.
The manifest's daily-logger extractors report `unparsed`: `REPOS`/`KNOWN_REPOS` moved into
`src/fleet.ts`. Its `auto` entries are declarations, not evidence that those surfaces were
checked. Extend those existing extractors/discovery adapters during implementation rather
than introducing another hand-maintained roster. TD-007/TD-010 and #315 own the gaps.

| Observed population | Count | Interpretation |
| --- | ---: | --- |
| Authenticated owner repositories | 56 | 28 public, 28 private; not synonymous with eligible fleet sources |
| Non-archived, non-fork owner repositories | 51 | Discovery candidates; collection/export/target grants still required |
| Committed frame-standup active list, all remotely confirmed | 43 | Fleet candidates, including paused and separately governed cases; not an authorized collection set |
| Northstar registry app entries | 22 | 21 intersect those 43; `fieldwork-1` unavailable in the observed remote set |
| Active-list candidates omitted from registry | 22 | Named in the table below; includes daily-logger and github-actions |
| Audit workflow among the 43 | 28 | 19 shared-action users; 9 placeholder producers |
| No audit workflow among the 43 | 15 | Visible missing consumers, not evidence of no sessions |
| Combinations qualified by this proposal | 0 | No provider/host/repository path was qualified; total intended combinations still unknown |

The 13 remote repositories outside the 43 are accounted for: `core-library`,
`diy-repair-qa-eval` and `ojfbot` are public active candidates awaiting a fleet-purpose
disposition; `gastown` and `hailstone` are active forks, provisionally excluded from CI
rollout pending a maintainer decision; `langchain-nextjs-template` and
`modelcontextprotocol` are archived forks; one additional private repository is archived;
five private active repositories, including `selfco`, require source-specific eligibility
and export decisions. The other private names are retained locally and deliberately not
added to public documentation. These exclusions apply to proposed CI rollout, not a claim
that authorized sessions in those locations should be unobservable.

`fieldwork-1` is a registry/discovery mismatch; `f1-learning-studio` appears in the ecosystem
table but not the remote inventory or its expected local directory. Neither is silently
deleted or treated as qualified. Top-level local discovery also found three repositories
without an `origin`; their private identities and purposes remain unresolved. Local duplicate
checkouts of core/cockpit were collapsed by canonical remote identity. No other remotely
identified top-level local repository added an owner repository beyond the API result.
Other hosts, nested roots, other accounts, non-fleet and projectless sessions remain an
explicit discovery gap, not zero. Thus **56 is the verified remote-discovery count, not a
universal session or repository count**.

### Confirmed fleet candidates at the inspected revisions

Each row is metadata evidence, not a new registry entry or an eligibility grant. All use
default branch `main`. `omitted` refers to the northstar registry at the core baseline.
`config` only means `.claude/settings.json` is tracked; it proves neither installation nor
capture. No tracked `.codex/hooks.json` was used to qualify any row.
Workflow blob keys below refer to `.github/workflows/claude-skill-audit.yml`:

- `f8489fd`: `f8489fd50b9af39ceb8c9182dfff9a017af77f80`, core-style prefetch plus shared action (8).
- `4df9e48`: `4df9e48eb3045a02b8acad50bd80186fe81eb72e`, shared action only (11).
- `888d980`: `888d980c23c155ee98b02b53ff5460be603a4aa0`, local-hook placeholder and consumer-origin fetch (8).
- `a9eefd0`: `a9eefd061fe9ae52228fb029ac2e1f2ec3c45d24`, daily-logger placeholder with core-source fetch (1).
- `none`: no skill-audit producer identified in the inspected workflow contents (15).

| Repository | Registry | Workflow | Config | Remote head |
| --- | --- | --- | --- | --- |
| agent-anatomy | omitted | f8489fd | absent | 65518cbfdb86846f10efcd958bba4ba9ecd3ba5e |
| asset-foundry | omitted | 4df9e48 | absent | f40ae07ae92ba7aa09f85e784c216a5fe665b7da |
| beaverGame | omitted | 4df9e48 | absent | 7f5deca469d83a1cd9ca8ae4533ced790ecec57e |
| bldgblog-corpus | omitted | none | absent | 3e045deefa13f0c1dedfbe9b03f13fbf55e91df3 |
| BlogEngine | yes | 888d980 | absent | 31f1de195c092a2050e81c619f20ce4a5aa1e1f7 |
| buddy-check | yes | none | absent | 37ed00b4e6cad2f8b1a13b7fa72a8a01af4d0e89 |
| capture-agent | yes | none | config | 8e41ba8f7515e71e96cda3a824bc6132e17bf98d |
| cca-prep | yes | f8489fd | config | 29f8a1482367922cdb1dcfd14042ccb60d7ba0ef |
| core | yes | f8489fd | absent | bc6d120503416c9d21d627730f27f2d10cfc13f8 |
| core-reader | omitted | 4df9e48 | absent | 480973916c7259c09e91cf8601e88eca4fdce266 |
| cv-builder | yes | 4df9e48 | absent | e5cecf370a9e5ac3d44583532e4b3274aad61d57 |
| daily-logger | omitted | a9eefd0 | absent | 75390193fc0415aebabb0ab34f1d6bf584b687f0 |
| dealdesk | omitted | none | absent | 529fe1eb7d548a6cb6f602d4b06d03b26ab48878 |
| dive-briefing | yes | f8489fd | config | 5631aeeff3767dd90fcf77f23d431fa2d8c7be35 |
| f1-doctrine | yes | f8489fd | config | c876338e4087dbed2b570f0abc42b45b31463bd2 |
| f1-pit-wall | yes | 4df9e48 | config | 92737ffc846044c238de1f7f61efcc26c3a3f9df |
| f1-press-room | yes | none | absent | 55c662d62f3cecb153eb88092292d779e7cb6ffa |
| f1-substrate | yes | 4df9e48 | config | 0ca97c219c80e806272b66c0b951a7cdc83569fe |
| fairway | yes | none | absent | 21b18118e734b291d0a8cfca77052cc28b11435b |
| foundry-recipes | omitted | 888d980 | config | 6339936321cf601c38268e3dfa9e7d170a67420e |
| frame-ui-components | omitted | 888d980 | config | db5100dc59af3a0d6dfa7cc61c4572e70e791210 |
| gastown-pilot | omitted | 4df9e48 | absent | 702596f9e8ca678300709d4b745d79d6f0f9b332 |
| github-actions | omitted | none | absent | e2b9ede2cf59d5d27f54904027f23ff813752866 |
| golf-platform-scripts | omitted | none | absent | 45217f799a8d8e33eb8b74e443ba61bde2d91d77 |
| GroupThink | omitted | none | absent | 7416f74644c620b145abc86b99534a7d4d930628 |
| jim-camera | yes | f8489fd | config | c630bb6a78a623ec429d451c84e47f7f0637cc91 |
| landing | omitted | 4df9e48 | absent | 5f33c47195ef87909430c20222f9c10884cd5422 |
| lean-canvas | omitted | 888d980 | config | fec03a08e246381955a758de42f9cd989f533d8d |
| lego-village-pipeline | yes | none | absent | 8aae0d658b0d8ba458f3adcc7ae79d041aaf2298 |
| lofi-beaver | omitted | 4df9e48 | absent | c6bdafa8df9994de5a14224c1f95e11d73aaee25 |
| mirrorworld | yes | f8489fd | config | e0953a4635b500696f6a5870506d3b4469bc3312 |
| morning-cockpit | yes | none | absent | baf1d1139ade33eae9126260f8f8e88b09752d50 |
| MrPlug | omitted | 888d980 | config | 3dc3dd220556b8ab8f5736f098bc1612ddd66105 |
| play-well-library | yes | none | absent | 1ee15e33a723d71e61d6f2bd9f480c9456f4fa86 |
| purefoy | omitted | 888d980 | absent | 04a9b7405be6de4ae363050a0a86da1aaeafb6ea |
| seh-study | omitted | 4df9e48 | config | 7482b7036e88b7b170d50fefed4cf32339b0ea44 |
| selfco-box | omitted | none | absent | dc02fbfac910ca049a3762d28c43f4df337e63b1 |
| shell | yes | 888d980 | config | 8e3a839b65dc55e12b6b3da9e099bf97100ef18f |
| silicon-empires | yes | none | absent | 32546b4a55ffee9d714b6ba497f928b69ac25de1 |
| switchboard | yes | f8489fd | absent | 57926bb314de4da21a8be9c267acc06d9e548af1 |
| TripPlanner | omitted | 888d980 | absent | 016ba34fcf750f3e0982c559f2d1c948122065c1 |
| virtualLight | yes | none | absent | f7a78cdabd8d46c2e856af779c46b174dd57e4ec |
| workstation-yuri | omitted | 4df9e48 | config | a1886516be0df3099a5ef8ceb238d145dcc07aaa |

### Capture, transport, consumers and publication paths

| Surface inspected | Actual behavior / evidence | Qualification gap and owner role |
| --- | --- | --- |
| Mac Claude user configuration | `session-init.sh` and `suggest-skill.sh` on UserPromptSubmit; `log-tool-use.sh` on PostToolUse; `reconcile-skill-acted.mjs` on Stop | Registration only; complete source interval and provider version unqualified. Collector owner under #279/#308 |
| Mac Codex user configuration | Initializer and suggester found; neither tool logger nor reconciler registered | Confirms earlier capture gap at this vantage; does not establish all native capture possibilities. Same owner |
| Core `install-agents.sh` | Links hook scripts from mutable core, adds repo Skill/Bash hooks, copies/refreshed core audit YAML; user-scope reconciler depends on built tracking code | Install success is not provider qualification; template can overwrite consumer changes. Installer owner |
| Remote hook entries | Core has executable blob `18cf7aa55e594a4ade574b440d66bd4398005af1`; 26 consumers track the external symlink blob above | Tracked-file checks alone miss dangling links; 29 other remote repos have no such entry. CI distribution owner |
| `sync-telemetry.sh` and launchd declaration | Filters five local JSONL streams to 48 hours by `.ts`, strips `input_summary`, writes metadata; empty total exits without a new snapshot; malformed input may be suppressed; pushes mutable branch | No manifest of capture completeness, schema/hashes, per-source authorization or healthy-empty heartbeat. Transport owner; installed/fired launchd state not qualified here |
| Core telemetry branch | Inspected commit `48b6aef1453dc4568665d8d97400c7f07c07dfda`; `synced_at` 14:01:44Z, cutoff 2026-10-01T14:01:43Z, five JSONL files present | Metadata presence does not establish interval coverage or freshness against an accepted policy; raw contents not exported/read for this census |
| Shared `skill-audit@v1` | Resolves to `e2b9ede2cf59d5d27f54904027f23ff813752866`; action blob `0775c7bf55a4b93361e184d33a594ed4e302e9c3`, script blob `887408452c4a107fe88d89e4e9da6d37e1d56533` | Bundles executable correctly via action path, but fetches consumer origin, reads legacy/tool/session streams, and uses repo basename/time proximity and comment-marker credit. Release owner |
| Core audit hook | Reads dispositions as primary but time-filters them without repo attribution because rows lack repo; retains separate inline and legacy paths | Copying this hook would import cross-repository attribution risk. Core observation owner |
| Daily-logger article consumer | `daily-blog.yml` clones core snapshot; `src/collect-telemetry.ts` blob `8b3ef84f06774dc9b5b0e76bc309279c16d0a8e7` aggregates engagement as skill use; `collect-context.ts` scrapes `skill-usage-report`/`skill-usage-update` comments | Article, PR report and issue report must share cohort-qualified claims, not scraped prose. Daily-logger maintainer |
| Morning cockpit | Loop adapter blob `a5dbc612a263cfa67cb778f8b08c93652492e128` at head above reads local dispositions; #502 adds separate provisional hygiene status | Consumer parity and version/freshness contract remain unqualified. Cockpit maintainer |
| Other core consumers | `skill-metrics.mjs`, `weekly-measure.mjs`, `analyze-telemetry.sh`, `generate-skill-report.sh`, suggestion/reconciliation path | Existing S23/S24 migration and OPAV semantics need parity, not another calculator. Core observation owner |
| Comment producers | Workflow/shared action upsert `skill-audit-results`; `bead-session.sh` emits `skill-usage-report` and `skill:pr-commented` despite suppressed command errors | Two reporting paths, no demonstrated common revision/receipt contract; inventory both before retirement. Publisher owner |
| Health declarations | `decisions/loops/loops.md`, `loops-lint.mjs`, `loops-liveness.mjs`, `audit-ci-health.sh` | Registry says consumers fail on stale telemetry; inspected workflows do not prove that. Existing CI-health enumeration is local-directory based and misses `.git` files/worktrees. #315/#318 own reconciliation |

Only configuration presence was inspected on the Mac. Other hosts/provider versions,
active native sessions, completeness of transcript discovery, installed release digests
and actual capture/liveness remain unknown. No local private session was opened to enlarge
this census. A future qualified unit is the authorized **repository or projectless scope ×
provider/version × host/capture adapter/version × interval**, with its own evidence and
export/target scope. Do not use `43 × 2` as a fabricated qualified denominator.

## Proposed clean-checkout distribution

Recommendation awaiting the operator's CI/publication-boundary decision: reuse
`ojfbot/github-actions/skill-audit` as a pinned consumer of fleet-runner report revisions;
fleet-runner retains one authorized publisher contract and durable reconciliation state.
The action can validate/report CI health and submit an attributable publication request;
it cannot independently reinterpret skill use or bypass publisher grants. Publisher hosting
and credential deployment remain #309/#313 decisions. This recommendation selects no service,
database, schema package or new public telemetry export.

| Option | Assessment |
| --- | --- |
| Pinned shared action consuming a versioned report | Recommended continuation of ADR-0067; clean checkout and one semantic source. Requires new release/compatibility qualification; current `v1` is not the new contract |
| Pinned core package invoked by every consumer | Possible packaging inside the shared action later; direct consumers would multiply runtime/dependency/lockfile integration. Defer until bounded package need is demonstrated |
| Central publisher without a consumer action | Fits authoritative publication, but needs an independent way to discover every eligible PR, observe missing consumers and return CI status. Keep publisher centralized logically; do not assume hosting/enumeration already exists |
| Copy/symlink hook or fetch mutable core branch | Reject for rollout: unresolved checkout dependencies, semantic drift and mutable builds; no qualification by operator-local success |

Pin **full release commit SHAs**, including transitive actions, and retain the release tag
as a human label. ADR-0067 prefers moving major tags; this is a proposed scoped amendment
for evidence-producing consumers, requiring acceptance before rollout. Pinning current
`v1` alone fixes neither semantics nor transport. Keep old readers explicitly legacy until
a versioned replacement passes qualification. No tag move or release is made here.

Required release contract:

1. Distinguish action code source (`ojfbot/github-actions` + release SHA), observation source
   (authorized provider/host/scope), snapshot origin (currently core for legacy transport),
   and target repository/PR/issue. Resolve target from authenticated event/API identity,
   pin PR head/base and explicitly pass `owner/repo`; never infer from `pwd`, basename,
   action checkout origin or a repository string embedded in untrusted report text.
2. Bundle or explicitly install every dependency from the pinned release. Current shell
   action uses Bash, git, gh, jq, bc, date and standard utilities plus github-script's Node
   runtime. The replacement must declare its supported runner OS/image and exact runtime
   and dependency versions; test with no core sibling, no user home configuration, no local
   symlinks and no preexisting `/tmp/telemetry`. Building a package uses the repo's pnpm
   version and frozen lockfile. Production consumers must not compile a mutable core checkout.
3. Declare compatible observation/report schema ranges, renderer, OPAV/evidence-policy,
   adapter and release versions. Unknown major or missing capability produces a typed
   coverage failure. No silent fallback from unsupported new records to legacy "used".
4. Separate read-only analysis from publication credentials. Consumer CI needs only target
   contents/PR metadata and approved snapshot access; publisher credentials are target-scoped
   for required PR and issue comments. Cross-repo access requires its own grant; a default
   workflow token is not assumed to read private core sources or write another repository.
   Do not execute PR code with publication secrets; fork PRs and unavailable grants retain
   an explicit publication-pending/unavailable outcome. No blanket PAT distribution.
5. Record release provenance, input digests, validated target mapping, permission profile,
   installation observation and compatibility result. A reviewed update PR includes old/new
   pins, qualification evidence and rollback release. Test installer/template idempotence
   and detect stale templates before they overwrite a qualified consumer; respect declared
   consumer variants. Release owner proposes; affected maintainer and operator promote.

The action must produce a structured outcome and reviewable failure report when its audit
component or data is unavailable. If action resolution prevents any step running, an
independent watcher must detect the missing expected outcome and route the coverage finding
through the same authorized publisher. This is a slice-4 prerequisite for broad rollout,
not a claim that `if: always()` survives all bootstrap failures. Preserve artifacts/check
evidence if publication itself is blocked. Proposed operational audit-health failure must
not be a successful audit; making it a merge-required check is a separate policy decision.
Adoption measurements continue to impose no session compliance gate.

## Snapshot availability, freshness and attribution

The new snapshot contract extends the existing projection. Each immutable snapshot identifies
producer/reconciler release, schema/evidence-policy versions, source grants/redaction policy,
source inventory revision, event-time bounds, ingestion time, per-source cursors/watermarks,
observed gaps/dropped or invalid records, declared files with hashes/counts, and completed
reconciliation status. Export only approved minimized evidence. A manifest must explicitly
state a zero-record complete interval; last event time cannot distinguish idle from dead.
The mutable `telemetry/daily` branch may remain a compatibility transport, but a read resolves
one commit and validates that exact manifest/files atomically before admitting it. Never
combine files fetched from changing heads or let another action overwrite an admitted input.

| State | Evidence required / rendering |
| --- | --- |
| Unavailable | Fetch/auth/parse failure, missing snapshot, unsupported contract or absent audit component; state source/stage/reason and last trustworthy revision if permitted |
| Missing required data | Transport returned, but required file/manifest/source interval absent; expose missing inputs, not zero activity |
| Partial | Some authorized sources/intervals present, but missing source, gap, malformed record, truncation or incomplete reconciliation; show bounded supported counts and omitted cohorts |
| Stale | Watermark/heartbeat fails accepted source-specific age or interval policy; show observed time and policy. A recent unrelated source cannot refresh a dead source |
| Healthy-empty | All expected authorized sources attest the complete requested interval, reconciliation and validators ran, zero matching activity; explicitly zero in that cohort only |
| Healthy with activity | The same complete checks pass with activity; evidence sufficiency for each application remains separately supported/refuted/indeterminate |

Missing/partial/stale can coexist per source; keep the reasons and dimensions even if the
summary selects one dominant condition. Until numeric freshness and closure thresholds are
accepted, show timestamps and policy-unconfigured/unqualified status; do not invent a production
health threshold. The current 48-hour export may not cover a multi-day PR or sessions after
the snapshot; declare the uncovered interval instead of treating a successful download as complete.
The observed snapshot contains all five legacy files but lacks this completeness contract.

PR attribution requires explicit, validated session/work/PR links and repository identity
mapping, including worktrees and forks. A time window or comment marker may nominate a candidate
association; it is not proof. Unjoinable dispositions lacking repository/session provenance
remain in an unresolved cohort. Same-time activity in another repo, multiple PRs in one repo,
repeated skill runs, same-name skills from different origins and late ingestion must not cross-credit.
Reports pin head/base, event-time interval, discovered session inventory and projection revision;
issue reports state their cumulative scope. Non-fleet/projectless sources remain separately
authorized and visible, with unrouted reports if no target is authorized.

Preserve the design's distinctions: suggestion generated versus delivered; explicitly accepted,
declined and deferred; loaded; application claimed and OPAV-verified; operationally ignored,
pending and unknown. An OPAV gap is evidence insufficiency even when collection is complete.
An incomplete collection cannot qualify ignoring. Heuristic recommendations have a labeled
diff-rule version and no measured-use claim; unavailable use evidence cannot become "not used".

## Daily-logger qualification and acceptance cases

Daily-logger is the first **complete** qualification case across authorized source observation,
reconciliation, OPAV assessment, attribution, report rendering, publication and independent
readback. Existing slice 1 supplies local provider proof; slice 2 supplies replay; slice 3
qualifies clean CI distribution and later actual delivery to explicitly designated test PR
and issue targets. PR #298 is defect evidence, not automatic authorization to post test reports.

The first implementation PR remains a thin local vertical slice (harness extension): extend
the existing slice-1 replay proof with a daily-logger clean-checkout fixture. Given explicitly
selected, redacted Claude/Codex observations and a target mapping, it emits session receipts,
OPAV assessments and deterministic PR/issue bodies, including the missing-component failure.
Run in an empty home and consumer checkout with the unresolved-link fixture. The result is
independently inspectable without deploying a collector or publishing a comment. Keep experimental
record shapes local to the proof; it does not choose the production package/runtime.

Prerequisites: operator-approved bounded scope; roadmap entry with named implementation owner;
reviewed fixture/export manifest; pinned provider contracts; a skill with a supported run-specific
OPAV evidence contract; expected positive and counterexample receipts; S25 overlap disposition.
Core observation maintainer owns this proof; daily-logger maintainer supplies target/cohort
expectations; github-actions maintainer reviews distribution feasibility. These are proposed
responsibility roles; no person is assigned or work dispatched by this document.

| Case | Required observable result | Stage |
| --- | --- | --- |
| R01 Clean checkout, valid evidence | Both pinned provider paths yield delivered suggestion, explicit response, load, independently assessed application and deliberate unsuggested run; correctly scoped PR/issue fixtures | Slice 1 local; repeat through released action in slice 3 |
| R02 Absent/non-executable/dangling component | Typed component-unavailable coverage report names release/target; zero successful-audit claim. Bootstrap failure becomes independent missing-run finding | Local fixture; clean runner and watchdog later |
| R03 Fetch denied/timed out/branch absent | Availability failure retained; approved last-good report labeled stale if shown; recommendations remain heuristic | Local; authorized clean runner |
| R04 Branch downloaded, file missing/hash mismatch/invalid schema | Reject inconsistent snapshot; expose missing/invalid inputs and quarantine records; no `available=true` shortcut | Local; authorized clean runner |
| R05 Stale/partial/window mismatch | Source-specific gaps stay visible; recent unrelated data cannot mask them; no all-session adoption percentage | Local; authorized clean runner |
| R06 Genuine zero activity | Fresh complete zero manifest plus independent source heartbeat yields healthy-empty; absent collector or skipped validator fails this case | Local; later authorized real empty interval |
| R07 Attribution adversaries | Other repo, other PR, unjoinable legacy row, shared basename, same-name package and unknown projectless target earn no cross-credit | Local; selected real mappings later |
| R08 Evidence adversaries | Read-only load, old artifact, forged application, missing contract and authored verified field cannot become verified application; coverage and OPAV result remain separate | Slice 1 local; provider qualification |
| R09 Late correction and policy revision | New immutable report supersedes prior assessment, preserves input/reason lineage and corrects each affected sink without adding a duplicate skill run | Slice 2 local; slice 3 remote |
| R10 Retry/concurrent publishers/restart | Stable operation identity deduplicates; no conflicting summary writer; a lost response remains unknown until outstanding effects are reconciled | Local fault model; authorized remote proof |
| R11 Required PR and issue delivery | Actual comments at both authorized targets independently read back with exact revision/body digest, publisher and target; one unavailable sink leaves obligation incomplete | Slice 3 live only |
| R12 Unknown remote outcome/revocation | Delayed acceptance, timeout, old backup and one absent read cannot release ADR-0109 hold; unauthorized changed target/grant does not publish | Local model; separately authorized live fault proof |
| R13 Remote edit/deletion/forged marker | Ownership/revision mismatch records divergence, retains historical receipt, does not overwrite human content or blindly retry | Local model; authorized remote proof |
| R14 Consumer parity/cutover/rollback | Daily article, PR, issue, cockpit and core audit agree for identical scopes/snapshot; differing scopes explain differences; rollback preserves facts and one publisher | Slice 3 shadow then bounded live |
| R15 Discovery/health drift | New repo, lost private scope, truncated API page, omitted workflow, stopped collector, dead reconciler and stopped consumer produce distinct gaps and named disposition routes | Slice 4 shadow then operational |
| R16 Authority and consumption | Shared-account authorship is insufficient human authority; publishing, rendering and reading a page cannot mint an acceptance/consumption receipt | Local; operative authority proof before live |

Every claimed R/SC rule needs nonzero executed positive and counterexample coverage, with
expected/actual results, source/release pins and retained evidence. All cases here are
**specified, not executed**. A synthetic input proves fixture behavior only. Provider
qualification needs authorized evidence from that actual pinned provider path; live publication
qualification needs real remote readback. A local report cannot pass either gate by itself.

## Rollout waves within the existing deliveries

MOE: reviewers can trust reported use and its limits across the authorized fleet. MOPs:
qualified combinations / eligible combinations, verified required deliveries / required
deliveries, evidenced source intervals / expected intervals, unresolved discovery/consumer
drift, and false-success/duplicate outcomes in qualification. The initial demonstrated
qualified count is zero; the final eligible combination denominator awaits grants and discovery.

These are refinements of existing slices, not new roadmap IDs. Vertical slice and shadow mode
are harness extensions. Every publication, replacement or failure-enforcement control first
runs in a Brassboard/shadow stage with proposed actions recorded and no real effect.

| Wave / existing slice | Entrance and proposed owner | Success Criteria and RIDM promotion evidence | Breach / rollback |
| --- | --- | --- | --- |
| W0: inventory and local daily-logger proof, slice 1 | Registered bounded scope and source grants; core observation owner + daily-logger maintainer | Verification: all claimed local cases pass with positive/counterexample counts >0; both provider paths have run-specific positive OPAV evidence. Validation: maintainer can identify evidence and gaps from both fixtures | Stay local/unqualified; preserve failed evidence; no collector or legacy producer replacement |
| W1: replay then daily-logger live qualification, slices 2–3 | W0 reviewed; contracts/grants/identity/recovery and freshness policy accepted; release pinned; named PR and issue test targets | Shadow: R01–R16 applicable cases modeled with zero false-success/duplicate/conflicting-writer outcomes. Live: 2/2 target types have exact readback; all claimed cases pass; operator approves RIDM against evidence | Freeze affected publication under ADR-0109 if uncertain; preserve old consumer until cutover; no blind retry |
| W2: daily-logger cutover and representative shared-action variants, slice 3 | W1 evidence; single-writer handoff agreed; github-actions/core/consumer maintainers assigned | Qualify daily-logger's article path plus core (`f8489fd`) and one `4df9e48` consumer such as landing. Exact snapshot/cohort parity, 100% required receipts and zero duplicate publishers in declared window | Restore prior qualified reader/release if compatible; otherwise explicit coverage failure. Do not restore a false-green placeholder as successful audit |
| W3: remaining placeholder and shared-action consumers, slice 3 | W2 and independent drift/health checks from slice 4; per-target source/publication grants | Generate batches from current inventory: remaining 8 placeholder producers, then remaining shared-action users; each eligible combination and configured sink has reviewed evidence and ownership, with zero unaccounted consumers | Stop promotion of affected cohort; unrelated qualified cohorts continue; retain facts and correction lineage |
| W4: missing consumers and all-session expansion, slices 3–4 | Per-source eligibility/grants, #279 host inventory, reviewed new consumer needs; named maintainer per candidate | Account for all 15 current missing candidates and later discoveries; qualify authorized non-runner, non-fleet/projectless and new provider/host/version paths. Unknown and excluded counts remain beside qualified counts | Unqualified/version-drift entries revert to visible pending/unknown; no disappearance from denominator |

The candidate numbers above are this census, not fixed batch membership. Rollout selection
is generated from a fresh reconciled inventory. `dealdesk` and `selfco` are explicitly excluded
from daily-logger's public blog today; that exclusion is not a universal collection decision
and must not be lifted by telemetry rollout. `selfco-box` is documented paused despite a
non-archived remote; obtain an owner disposition. LEGO/play-well correspondence replacement
retains its separate steward/operator ratification requirements. Read-only observation does
not confer permission to migrate their protocols or publish private claims publicly.

Before retiring either marker producer, inventory workflow, shared-action and local
`bead-session` writers for the target; record last report/remote comment IDs and unresolved
operations. Shadow replacement emits no competing authoritative summary. After qualification,
perform an authorized handoff: stop old writer, account for outstanding writes, transfer
summary ownership and verify new delivery; only then retire the obsolete path. Existing
comments remain evidence. Legacy `skill-audit-results` and `skill-usage-report` markers are
aliases mapped deliberately to the new report lineage, never substring ownership proof.
New immutable revisions carry the report identity/revision; at most one optional convenience
summary is owned by the authorized publisher per target/topic. Rollback changes the consumer
release, not report history or publisher authority. Unknown effects retain the affected-item hold.

The release qualification bundle must include census revision and eligibility dispositions;
per-combination source/installation/version/grant evidence; clean-runner image and release pins;
executed case counts/results; report/snapshot revisions and hashes; actual PR/issue URLs and
readbacks; shadow parity differences; owner/promotion decision and rollback observation.
Freshness, retry/escalation and recovery thresholds and the observation window must be
precommitted by their policy owners before operational qualification. Zero-error fixture
criteria do not substitute for a chosen live observation duration or statistical accuracy goal.

Completion is inventory-derived: every discovered candidate has an evidenced eligibility
disposition; every eligible combination in the accepted scope is qualified for its current
versions and interval; every required consumer/target has verified delivery and a demonstrated
correction/rollback path; no unknown publisher or unresolved discovery omission remains.
Report excluded, unavailable and pending counts with reasons. A qualified subset can complete
a wave but cannot earn "full fleet" or "all sessions" coverage while discovery is incomplete.
No activity, no PRs or no report consumption are separate outcomes, never exemptions inferred
from silence. Source retention limits must remain visible even after a successful rollout.

## Drift, onboarding and ownership after rollout

Extend existing fleet-manifest reconciliation with dynamic GitHub discovery and local/host
observations; use the registry for meaning and the fleet-onboard surface matrix for repair
routing. Refresh through an already approved maintenance rail after its owner/cadence is
selected in #318; no new scheduler is created here. Compare expected consumers and qualified
release pins with current workflow blobs, action releases, enabled workflow/run state,
collector installation/capabilities, snapshot health, receipts and consumption evidence.
Use loops-lint/liveness and audit-ci-health as read-only probes, fixing their observed vantage
limitations within registered work. An `auto`, zero exit or recent commit is not a health pass.

Newly discovered repos enter pending eligibility automatically; an unknown private repo remains
unexported. An accepted eligibility/grant leads to owner assignment through the canonical
roadmap and the same daily-logger-derived qualification contract, not silent installation.
Renames/transfers update observed locators without re-keying work or losing receipts. New
provider or host versions invalidate only the affected qualification, preserving prior evidence.
Changes in grants can stop export/publication while local source facts remain subject to the
approved retention policy. Lost enumeration credentials must be distinguishable from repo deletion.

Independent checks produce scoped findings with existing owners/disposition references and
required coverage-failure reports to authorized targets. Unrouted findings remain visible in the
store/operator view. Drift checks cannot create grants, trigger arbitrary repairs or manufacture
consumption. The verifier's own expected runs and evidence need an independent observation path
and stop/usefulness policy under #318; the base case remains a decision there.

## Decisions required before execution

| Decision | Existing venue / accountable role | Consequence while unresolved |
| --- | --- | --- |
| Shared action as consumer with fleet-runner publication versus consumer-owned publishing | Operator; #313 and current design review | Recommendation only; no publisher implementation or credential deployment |
| Eligible repo/source/host combinations, private/non-fleet/projectless collection and exports | Operator + source owners; #315/#279/#309 | Candidates remain pending, exports denied absent grant; full denominator cannot be claimed |
| Bounded profile, identity/canonical state, authorized writers and trustworthy human grants | Proposed #495 ADR, #311/#313 | No operative schema/authority claim; #501 D references reconciled explicitly |
| Freshness/closure/retention, correction, reconciliation/reopening and recovery targets | #309/#313/#316/#318 and ADR-0109 follow-up | Display facts/unknowns; no operational ignored or healthy claim without applicable policy |
| Immutable action pin exception and release/compatibility ownership | ADR-0067 amendment; release owner/operator | Proposed pin policy; current moving tag not promoted as qualified |
| First proof scope/owner/check and S23/S24/S25 overlap | Canonical roadmaps under #307 | Pickup remains inert; no new tracking queue or delivered movement |

## Verification and skill-use receipt

Executed research: remote census, four workflow-blob classifications, current policy/issue
reads, PR #298 run-log inspection and independent readback of its existing comment; local
configuration inspection and fleet-manifest shadow reconciliation. These are observations,
not tests of the proposed runtime. Local documentation checks and review results belong in
the delivery PR. No collector, provider, action release or live publication path was qualified.

`grill-with-docs` was loaded and used to separate facts from the unresolved publication-boundary
decision; no completed grill or OPAV application is claimed. `gated-slice` supplied the proposed
wave/gate and rollback structure above. `pr-review` supplies the later two-axis review of this
change. `spec-review` was inspected but not separately applied; the PR's Spec axis covers the
proposal. These are attributed workflow-use statements, not independently verified application
receipts. No suggestion IDs or application events were fabricated; no telemetry export or live
ledger mutation was performed. Existing provider capture limitations remain visible.
