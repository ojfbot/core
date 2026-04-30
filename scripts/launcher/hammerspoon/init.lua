-- core/scripts/launcher/hammerspoon/init.lua
--
-- Symlinked from ~/.hammerspoon/init.lua by core/scripts/launcher/scripts/bootstrap.sh.
-- Loaded automatically when Hammerspoon starts.
--
-- Responsibilities:
--   1. Bind the URL event hammerspoon://ojfbot-launch to the launcher.
--   2. Start the menubar status item (status.lua).
--   3. Wire global hotkeys for direct rig-window switching.
--
-- See ADR-0064 (decisions/adr/0064-hammerspoon-workspace-orchestration.md).

local launcher = require('launcher')
local status = require('status')
local telemetry = require('telemetry')
local log = require('util.log')

log.info('init.lua loading')

-- URL event hammerspoon://ojfbot-launch
hs.urlevent.bind('ojfbot-launch', function(_, _)
  log.info('URL event ojfbot-launch fired')
  local ok, err = pcall(launcher.run)
  if not ok then
    log.error('launcher.run pcall: ' .. tostring(err))
    hs.alert.show('launcher error: see ~/Library/Logs/ojfbot-launcher.log')
  end
end)

-- Menubar status item polls tmux session state every 5 seconds.
status.start()

-- Global hotkeys (cmd+alt). These match the registrations'
-- claude_sessions.interactive.key_binding values, but Hammerspoon owns the
-- global scope so they work even when the terminal isn't focused.
local mods = { 'cmd', 'alt' }
hs.hotkey.bind(mods, '1', function() launcher.focusWindow('shell') end)
hs.hotkey.bind(mods, '2', function() launcher.focusWindow('core') end)
hs.hotkey.bind(mods, '3', function() launcher.focusWindow('daily-logger') end)
hs.hotkey.bind(mods, '4', function() launcher.focusWindow('gastown-pilot') end)
hs.hotkey.bind(mods, 'm', function() launcher.openIntake() end)
hs.hotkey.bind(mods, 'f', function() telemetry.tail() end)
hs.hotkey.bind(mods, 'l', function() launcher.run() end)

-- Auto-reload on changes to any *.lua file in this directory.
local config = hs.pathwatcher.new(os.getenv('HOME') .. '/.hammerspoon/', function(files)
  for _, f in ipairs(files) do
    if f:sub(-4) == '.lua' then
      hs.reload()
      return
    end
  end
end):start()

hs.alert.show('ojfbot launcher loaded')
log.info('init.lua loaded')
