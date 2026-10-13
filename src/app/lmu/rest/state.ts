import type { LmuRestSession } from '@irdashies/types';

/**
 * What the REST poller has learned, in the shape the mappers want it.
 *
 * Owned by the bridge and read synchronously by the telemetry loop, so the loop
 * never awaits an HTTP request. Same create/reset lifecycle as
 * `createLmuLapDistanceState` in ../lapDistance.ts, which is the house pattern
 * for bridge-scoped mutable state.
 *
 * `cells` holds **pre-built telemetry cells** rather than raw numbers so a
 * mapper call is a reference assignment per channel and a frame allocates
 * nothing.
 *
 * The invariant that makes that safe: the poller **replaces** a cell object
 * when its value changes and never mutates `cell.value` in place. A frame
 * already handed to a processor therefore stays internally consistent. The
 * `readonly` below is there to make an in-place mutation a type error, because
 * that is the one edit that would corrupt a published frame.
 */
export interface LmuRestCell<T> {
  readonly value: readonly T[];
}

export interface LmuRestCells {
  pitStopTime?: LmuRestCell<number>;
  repairTime?: LmuRestCell<number>;
  refuelTarget?: LmuRestCell<number>;
  refuelTargetIsVirtualEnergy?: LmuRestCell<boolean>;
  brakeWear?: LmuRestCell<number>;
  suspensionDamage?: LmuRestCell<number>;
  aeroDamage?: LmuRestCell<number>;
}

export interface LmuRestData {
  /**
   * Bumped only when something destined for the Session snapshot changes.
   *
   * The bridge watches this to force a session republish, because
   * `lmuSessionSignature` only sees shared memory and would otherwise never
   * notice a REST-sourced field arriving. Deliberately *not* bumped by the
   * telemetry cells: those reach widgets on the ungated telemetry path, and
   * bumping here would force a full session rebuild and a whole-object IPC
   * broadcast every time a wear figure twitched.
   */
  revision: number;
  cells: LmuRestCells;
  session: LmuRestSession;
}

export const createLmuRestData = (): LmuRestData => ({
  revision: 0,
  cells: {},
  session: {},
});

/**
 * Forgets everything, and bumps `revision` so the cleared state publishes.
 *
 * Called when LMU goes away. Publishing the clear matters as much as publishing
 * the data: a stale pit-stop estimate left on screen after the session ended
 * reads as current.
 */
export const resetLmuRestData = (data: LmuRestData): void => {
  data.cells = {};
  data.session = {};
  data.revision += 1;
};
