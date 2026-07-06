-- Dolt BeadStore schema — ADR-0016 compliant
-- Database: ~/.beads-dolt (frame_beads)
-- Server: dolt sql-server on port 3307

CREATE TABLE IF NOT EXISTS beads (
  id VARCHAR(128) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'created',
  title VARCHAR(512) NOT NULL,
  body TEXT,
  labels JSON,
  actor VARCHAR(128) NOT NULL,
  hook VARCHAR(128),
  molecule VARCHAR(128),
  refs JSON,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  closed_at DATETIME
);

CREATE INDEX idx_beads_type ON beads(type);
CREATE INDEX idx_beads_status ON beads(status);
CREATE INDEX idx_beads_actor ON beads(actor);

-- ── Reserved bead labels: unassigned-queue contract (ADR-0002, coordination rollout S3) ──────────
-- Stored in beads.labels (JSON). Set by `queue-post` (scripts/hooks/bead-emit.mjs); enforced by
-- `queue-claim` (S4). Mirrored in morning-cockpit packages/shared/src/dolt-bead.ts.
--   labels.queue      : 'available' | 'claimed' | 'expired' | 'incubating'
--                       'available' = a DELIBERATELY posted unassigned task (vs default-'created' cruft).
--   labels.kind       : 's' | 'm' | 'l'  — size/TTL class.
--   labels.autonomy   : 'human_only' (default) | 'agent_eligible' | 'either'  — who may claim.
--   labels.posted_at  : ISO 8601 — when queue-post ran.
--   labels.expires_at : ISO 8601 — posted_at + kind TTL (s=2d, m=5d, l=10d). Expired-but-available
--                       renders STALE; `queue-sweep` (S4+) flips it to queue='expired'.
-- Set on claim (S4) by `queue-claim` (+ `hook` = the claimer; renewed by `queue-renew`):
--   labels.claimed_at      : ISO 8601 — when the claim landed.
--   labels.claimed_by_kind : 'human' | 'agent'.
--   labels.lease_until     : ISO 8601 — self-expiring hold (human ~8h, agent ~min). Past-due leases
--                            are returned to 'available' by `queue-sweep` (dead-claim safety valve).
-- Trace identity (S21, SHADOW — emitted, nothing consumes it yet):
--   labels.trace_id        : UUID minted at queue-post/compile, threaded queue bead → day-runner
--                            session env (TRACE_ID) → pr-created bead + 'Trace:' PR-body line.
--                            Optional on every bead; key follows OTel gen_ai trace-correlation naming.

CREATE TABLE IF NOT EXISTS bead_events (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  event_type VARCHAR(64) NOT NULL,
  bead_id VARCHAR(128),
  actor VARCHAR(128),
  summary TEXT,
  timestamp DATETIME NOT NULL,
  payload JSON,
  INDEX idx_events_bead_id (bead_id),
  INDEX idx_events_type (event_type),
  INDEX idx_events_timestamp (timestamp)
);
