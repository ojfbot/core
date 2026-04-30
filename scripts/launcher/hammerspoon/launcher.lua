-- core/scripts/launcher/hammerspoon/launcher.lua
--
-- The orchestrator. Brings up the tmux session and lands the user on it.

local M = {}
local log = require('util.log')

local LAUNCHER_ROOT = '/Users/yuri/ojfbot/core/scripts/launcher'
local SESSION = 'ojfbot'

-- Wrap hs.execute and return (stdout, ok) with safe defaults.
local function shellOut(cmd)
  local stdout, ok = hs.execute(cmd, true)
  return stdout or '', ok == true
end

-- M.run — the URL-handler entry point.
function M.run()
  log.info('launcher.run start')

  -- 1. Bring up the tmux session if it's not already up.
  log.info('checking session existence')
  local out, sessionExists = shellOut('tmux has-session -t ' .. SESSION .. ' 2>&1')
  log.info(string.format('has-session: exists=%s out=%q', tostring(sessionExists), tostring(out)))
  if not sessionExists then
    log.info('session missing; running launch.sh')
    local out, ok = shellOut(LAUNCHER_ROOT .. '/scripts/launch.sh ' .. SESSION .. ' 2>&1')
    if not ok then
      log.error('launch.sh failed: ' .. (out or ''))
      hs.alert.show('ojfbot launch failed (check log)')
      return
    end
  else
    log.info('session ' .. SESSION .. ' already up')
  end

  -- 2. Open Terminal.app and attach.
  local script = [[
    tell application "Terminal"
      activate
      do script "exec tmux attach -t ojfbot"
    end tell
  ]]
  local ok, returnedValue, descriptor = hs.osascript.applescript(script)
  if not ok then
    local detail = ''
    if type(descriptor) == 'table' then
      detail = string.format(
        'NSLocalizedDescription=%s | NSLocalizedFailureReason=%s | OSAScriptErrorAppName=%s',
        tostring(descriptor.NSLocalizedDescription),
        tostring(descriptor.NSLocalizedFailureReason),
        tostring(descriptor.OSAScriptErrorAppName))
    else
      detail = tostring(descriptor)
    end
    log.error('AppleScript failed: ' .. detail)
    hs.alert.show('Terminal control denied — grant Automation in System Settings')
    return
  end
  log.info('AppleScript ok; returned ' .. tostring(returnedValue))

  -- 3. After Terminal is up, move it to the primary screen and maximize.
  hs.timer.doAfter(1.2, function()
    local term = hs.application.find('Terminal')
    if term then
      local win = term:focusedWindow()
      if win then
        win:moveToScreen(hs.screen.primaryScreen())
        win:maximize()
      end
    end
  end)

  hs.alert.show('ojfbot launching…')
  log.info('launcher.run complete')
end

-- M.focusWindow — switch to a specific rig's tmux window by id.
function M.focusWindow(rigId)
  local out = hs.execute(
    "tmux list-windows -t " .. SESSION ..
    " -F '#{window_name}|#{@rig_id}' 2>/dev/null", true) or ''

  local target
  for line in string.gmatch(out, '[^\n]+') do
    local name, id = line:match('(.+)|(.+)')
    if id == rigId then
      target = name
      break
    end
  end

  if not target then
    hs.alert.show('no rig window: ' .. rigId)
    return
  end

  hs.execute(string.format("tmux select-window -t %s:'%s'", SESSION, target), true)

  local term = hs.application.find('Terminal')
  if term then term:activate() end
end

-- M.openIntake — open the gastown-pilot Intake URL in the default browser.
function M.openIntake()
  hs.urlevent.openURL('http://localhost:3017/intake')
end

return M
