/**
 * Passive hook for LapTimes calculations.
 * In Phase 2, this hook no longer subscribes to raw telemetry.
 * The updates are pushed from HeadlessTelemetryOrchestrator.
 */
export const useLapTimesStoreUpdater = () => {
  // Now does nothing. Updates are handled by the central Orchestrator.
  return null;
};
