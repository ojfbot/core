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
