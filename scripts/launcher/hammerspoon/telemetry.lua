-- core/scripts/launcher/hammerspoon/telemetry.lua
--
-- Open a Terminal window tailing the central skill-telemetry JSONL.
-- Substrate per ADR-0037; replaces the OTLP feed proposal from the original
-- ADR-009.

local M = {}

local TELEMETRY_PATH = os.getenv('HOME') .. '/.claude/skill-telemetry.jsonl'

function M.tail()
  -- Format each line as: <ts> <skill> <repo>
  local cmd = string.format(
    [[exec tail -f %q | /opt/homebrew/bin/jq -r '\"\\(.ts) \\(.skill // \"\") \\(.repo // \"\")\"']],
    TELEMETRY_PATH)
  hs.osascript.applescript(string.format([[
    tell application "Terminal"
      activate
      do script "%s"
    end tell
  ]], cmd))
end

return M
