export const LMU_DISCONNECT_GRACE_MS = 3000;

export function shouldHoldLmuRunningState(
  wasRunning: boolean,
  unavailableSince: number | null,
  now: number
): boolean {
  return (
    wasRunning &&
    unavailableSince !== null &&
    now - unavailableSince < LMU_DISCONNECT_GRACE_MS
  );
}
