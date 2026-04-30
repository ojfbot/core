-- core/scripts/launcher/hammerspoon/util/log.lua
--
-- Append-only file logger. Hammerspoon's console is fine for development
-- but a file log survives restarts and is greppable.

local M = {}

local LOG_PATH = os.getenv('HOME') .. '/Library/Logs/ojfbot-launcher.log'

local function write(level, msg)
  local f = io.open(LOG_PATH, 'a')
  if not f then return end
  f:write(string.format('%s [%s] %s\n', os.date('%Y-%m-%d %H:%M:%S'), level, msg))
  f:close()
end

function M.info(msg)  write('INFO',  tostring(msg)) end
function M.warn(msg)  write('WARN',  tostring(msg)) end
function M.error(msg) write('ERROR', tostring(msg)) end

return M
