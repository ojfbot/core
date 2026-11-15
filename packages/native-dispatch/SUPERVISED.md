# Owner-attended subscription canary

Codex subscription execution is held with `native-profile-unqualified`. The qualified Codex
allowlist is empty, with no operator override or provider fallback. Because the supervised plan
requires both providers, the entire plan remains held before a dispatcher or reservation is created.
Preparation and BASIC coordination remain available.

The live trial under charter 3203 completed one Codex turn on each host. Both actual subscription
rollouts exposed `additional_tools`, including execution tools. No tool calls were recorded, and
Claude was not invoked. The approved subscription tool-omission claim is disproven. The completed
turns and spent budgets remain historical evidence (HelpDesk 3856/3857).

These formerly admitted Codex tuples are revoked:

| Native version      | Binary SHA-256                                                     |
| ------------------- | ------------------------------------------------------------------ |
| `0.165.0-alpha.1.2` | `d84a54b031085f01e3ad915ea7c72ebea4dcf69e90f0d1e0e4a637e8280991d2` |
| `0.164.0`           | `d8990e3ee7acfbc26f91265b12a1a83f0fee40d0e0f8f1f40a37d4ec21f499cf` |

The earlier loopback `response.create` capture used synthetic API authentication, an ephemeral
credential store and a redirected base URL. Its omitted tool fields describe that capture only.
It does not qualify the subscription path or establish an empty live tool inventory. The API
receipts remain historical evidence, including signed HelpDesk 3364/3374, 1,204 bytes with SHA-256
`26882f34b3089893316b15d68c2ea1c4dcda18e464a617d2c59d8364e79e2801`.
No new model call is needed to verify revocation. Re-enablement requires separate evidence and
approval. Post-event filtering cannot establish that tools were unavailable before execution.

This separate 0.3 entry implements the supervised contract in HelpDesk charter 3203. It does not
arm `openDispatcher`, `openCanaryQualification` or the disabled 0.2 runtime entry.

`prepareSupervisedSubscriptionCanary(unknown)` accepts the existing two-provider plan, fixed
fixture and limits, plus `supervision: { kind: "owner-attended", codexHostFileReadRiskAccepted: true }`
and `environment: { HOME, CODEX_HOME, TMPDIR }`. These are exactly three plan keys: `HOME` is an
absolute path; the other two are absolute paths or `null`, which requires that variable to be absent.
The normalized environment participates in the plan digest. The opener freezes the child environment,
including `USER` and `LOGNAME` from the listener job; those identity fields are not plan keys.
Environment drift is refused before probes and native effects with `environment-mismatch`.
It returns a normalized plan, its digest, `mode: "supervised-prepared"` and `liveEligible: false`.
Preparation creates no session or approval and invokes no native command.

`openSupervisedSubscriptionCanary({ prepared, stateFile, runtimeApprovalFile, deviceId })`
returns `held` with explicit hold codes, or `ready` with the shared dispatcher. `deviceId` comes
from the receiver's own enrollment. The approval is a local operator boundary, not cryptographic
proof of a human statement. Only direct owner words in that Mac's own chat authorize creating it.

The approval JSON has kind `owner-approved-supervised-canary`, the exact `planDigest`, `windowId`
and `deviceId`, integer `startsAtMs` and `expiresAtMs` exactly 1,800,000 milliseconds apart, and a
nonempty `ownerNativeApprovalRef`. It also requires `invocationStateFile` equal to the opener's
captured canonical `stateFile`; a new journal cannot silently obtain a fresh budget under that approval.
A peer message cannot provide runtime authority. The builder
and preparation API do not write this file. Missing, mismatched, loose, foreign-device or expired
approval remains held.

Private files are opened once with no-follow, checked on the descriptor and read with a byte bound.
Canonical inode checks bind path inspections to that descriptor. Owner/mode and read-only Mac ACL
checks cover approval, journal parents and empty working folders; unqualified platforms or ACLs
hold. Ancestors must resist other-user replacement; root-owned sticky temporary parents are
allowed. Use a fresh canonical private folder outside a checkout, with separate empty native
working folders. Any extended ACL in this path is conservatively refused, including a deny-only ACL.
Native binaries must retain their canonical paths, executable modes, pinned hashes and versions.

The opener and each new invocation repeat the approval/window, file and native checks. Approval
bytes are frozen by digest and reread after slow preflight and immediately before native launch;
removal or replacement holds. The binary hash is checked again after schema validation, just before
the final local authority check and spawn. This narrows the same-user replacement race without
claiming atomic hash-to-execution isolation. All supervised expiry checks and the native deadline
use the wall clock (`Date.now()`); callers cannot inject a supervised clock. Static
preflight uses only version/help, documented policy metadata and Codex's startup-requirements
printer and the qualification gate; it sends no model turn. The empty Codex allowlist refuses
Codex before these native probes. Existing managed
configuration or unavailable policy evidence returns `native-profile-unqualified`. Static checks
accept managed-preference absence only when `defaults` exits 1 without a spawn error and reports
an exact known missing-domain or missing-key message for the queried domain and key. The known
macOS timestamp prefix is allowed. Present settings and unexpected diagnostics remain held. Static checks
alone do not qualify a new tuple. Actual subscription behavior requires the attended proof.

Codex uses an actual existing, otherwise empty native session UUID, with no fallback creation or
implicit latest-session selection. A preselected UUID is not creation evidence. The retained candidate
`exec resume` recipe pins provider `openai`, ignores user config and execpolicy rules, selects read-only/never approvals,
disables web search, apps, browser features, hooks, extra-agent and plugin discovery features, and
limits the inherited environment. Command-network denial comes from the read-only sandbox.
The global `-C` also pins the declared working root when resuming a session with saved metadata.
Read-only still permits host file reads; it is not a no-tools profile or separate-user isolation.
The managed-policy key locations follow [OpenAI's managed configuration reference](https://learn.chatgpt.com/docs/enterprise/managed-configuration);
web and apps are separate controls in the [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

Claude uses safe mode, empty setting sources and built-in tools, strict empty MCP configuration,
disabled hooks/connectors, no permission prompts, one top-level turn and a JSON output schema.
For `initial-fixed`, the reserved UUID's first print is its counted creation turn. There is no
separate creation prompt, API-key fallback, bare mode or model fallback. Native init must report
the exact model selector and empty tools/MCP lists; use an exact native model name when an alias
would resolve differently. [Claude's CLI reference](https://code.claude.com/docs/en/cli-reference)
documents that managed policy can remain active in safe mode, so unresolved managed settings hold.

The engine durably reserves one invocation per binding and two per device/window before launch.
Only one invocation across the device/window journal may be active or unresolved at once; the other
provider receives `busy` without consuming a reservation. Mechanical qualification retains its
per-session controller behavior.
Timeout is at most 120 seconds and never exceeds the window. Identical deliveries reuse committed
evidence. Unknown effects stay spent and retain their controller across restart. A proven
engine prelaunch hold is terminal and refunded; no started or ambiguous effect is refunded or retried.
Failure of the transport's final hash/approval check conservatively retains an unknown spent reservation.
Only the frozen trusted fixture and validated metadata pointer become model input. Output is
bounded to 64 KiB; accepted result text retains the existing 2,048-character/4,096-byte bounds.

`lookup(deliveryId)` retains native observation IDs and outcome; a CLI without a turn ID reports
`nativeTurnId: null`. `agentProposal(deliveryId)` separately retains accepted ACK/result data with
`source: "supervised-native"`, `attribution: "device-relayed-output"` and `verifiedWork: false`.
Native completion does not verify the requested work or create a signed HelpDesk reply. The
receiver owns its idempotent attributed reply outbox. Supervised status reports `realProviderCalls:
null`: dollars, output tokens and provider-internal requests remain unproved. The durable limit is
top-level invocations, not a native token or monetary budget.

The focused tests execute local synthetic CLI programs only. They cover held authority, both
provider event paths, bounded command recipes, duplicate/restart reuse and uncertainty that remains
spent. Mac no-inference inventory and these tests do not count as the owner-attended four-turn proof.

## Prove the installed block offline

Run the packaged proof with a readable prepared plan or raw plan from this host:

```sh
pnpm exec node <installed-package>/scripts/prove-codex-revocation.mjs <plan.json>
```

The script imports that package's production gate and public opener. It checks both revoked tuple
declarations before any provider spawn, then checks this host's actual pinned binary metadata in
the public opener with fresh TEST-ONLY plan, approval and directories. Only filesystem ACL reads
through `/bin/ls -lde` are allowed by the spawn sentinel. No provider version, help, auth or model
command runs. The proof prints its result and removes only its own temporary fixtures. It never
uses a real runtime approval or changes a job, plan, journal or historical trial evidence.
