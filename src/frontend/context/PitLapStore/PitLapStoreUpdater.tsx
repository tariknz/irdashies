/**
 * Passive hook for PitLap calculations.
 * In Phase 2, this hook no longer subscribes to raw telemetry.
 * The updates are pushed from HeadlessTelemetryOrchestrator.
 */
export const usePitLapStoreUpdater = () => {
  // Now does nothing, or could be used for logic that doesn't
  // require high-frequency telemetry subscriptions.
  return null;
};
