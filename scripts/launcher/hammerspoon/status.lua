-- core/scripts/launcher/hammerspoon/status.lua
--
-- Menubar status item. Polls the ojfbot tmux session every 5 seconds and
-- aggregates per-window state into a single glanceable line.
-- Click opens a per-rig dropdown.

local M = {}
local SESSION = 'ojfbot'
local POLL_INTERVAL = 5  -- seconds

local STATE_GLYPH = {
  healthy_infra = '▪',
  healthy_active = '●',
  idle_active = '○',
  needs_attention = '!',
  broken = '✗',
}

local function readWindows()
  local out = hs.execute(
    "tmux list-windows -t " .. SESSION ..
    " -F '#{@rig_id}|#{@rig_state}' 2>/dev/null", true) or ''
  local windows = {}
  for line in string.gmatch(out, '[^\n]+') do
    local id, state = line:match('(.+)|(.+)')
    if id and state then
      table.insert(windows, { id = id, state = state })
    end
  end
  return windows
end

local function tally(windows)
  local c = { healthy_infra = 0, healthy_active = 0, idle_active = 0,
              needs_attention = 0, broken = 0 }
  for _, w in ipairs(windows) do
    if c[w.state] ~= nil then c[w.state] = c[w.state] + 1 end
  end
  return c
end

function M.poll()
  if not M.menubar then return end

  local sessionExists = false
  local _, _, code = hs.execute('tmux has-session -t ' .. SESSION .. ' 2>/dev/null; echo $?', true)
  -- hs.execute returns: stdout, success, type, code. We can't trust the boolean
  -- (tmux has-session writes nothing on success but returns nonzero on miss).
  -- Use the textual approach: parse `echo $?`.
  local out = hs.execute('tmux has-session -t ' .. SESSION .. ' 2>/dev/null && echo OK || echo MISSING', true) or ''
  sessionExists = out:match('OK') ~= nil

  if not sessionExists then
    M.menubar:setTitle('ojfbot ⛔')
    M.menubar:setMenu({
      { title = 'session not running', disabled = true },
      { title = '-' },
      { title = 'Launch ojfbot', fn = function() require('launcher').run() end },
    })
    return
  end

  local windows = readWindows()
  local c = tally(windows)
  local active = c.healthy_active + c.idle_active
  M.menubar:setTitle(string.format('ojfbot %d● %d▪ %d! %d✗',
    active, c.healthy_infra, c.needs_attention, c.broken))

  local menu = {
    { title = 'Session: ' .. SESSION, disabled = true },
    { title = '-' },
  }
  for _, w in ipairs(windows) do
    local glyph = STATE_GLYPH[w.state] or '?'
    local id = w.id
    table.insert(menu, {
      title = string.format('  %s %s', glyph, id),
      fn = function() require('launcher').focusWindow(id) end,
    })
  end
  table.insert(menu, { title = '-' })
  table.insert(menu, { title = 'Open Intake (gastown-pilot)',
    fn = function() require('launcher').openIntake() end })
  table.insert(menu, { title = 'Tail skill-telemetry',
    fn = function() require('telemetry').tail() end })
  table.insert(menu, { title = '-' })
  table.insert(menu, { title = 'Re-run launch.sh',
    fn = function() require('launcher').run() end })
  table.insert(menu, { title = 'Kill session', fn = function()
    hs.execute('tmux kill-session -t ' .. SESSION, true)
  end })
  M.menubar:setMenu(menu)
end

function M.start()
  M.menubar = hs.menubar.new()
  if not M.menubar then return end
  M.menubar:setTitle('ojfbot …')
  M._timer = hs.timer.doEvery(POLL_INTERVAL, M.poll)
  M.poll()
end

return M
