/** Start when the owner's reboot command has returned, excluding the interactive password wait. */
export function rebootRecoveryWindow(armedAt, commandReturnedAt) {
  if (
    !Number.isSafeInteger(armedAt) ||
    !Number.isSafeInteger(commandReturnedAt) ||
    commandReturnedAt < armedAt
  ) {
    throw new RangeError("invalid reboot timing");
  }
  return {
    startedAt: commandReturnedAt,
    deadline: commandReturnedAt + 300_000,
    ownerWaitMs: commandReturnedAt - armedAt,
  };
}
