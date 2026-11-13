import type { RacePlanState } from '@irdashies/types';
import type { ActiveRacePlan, RacePlanService } from './racePlanService';

type RacePlanSource = Pick<
  RacePlanService,
  'getActivePlan' | 'getState' | 'onChange'
>;

/**
 * Lets main-process consumers, such as the race plan progress processor and
 * the browser-view proxy, reach the service that `main.ts` creates. Null until
 * the bridge is set up.
 */
let source: RacePlanSource | null = null;

export const setRacePlanSource = (next: RacePlanSource | null): void => {
  source = next;
};

export const getActiveRacePlan = (): ActiveRacePlan | null =>
  source?.getActivePlan() ?? null;

/** The renderer-safe state: it never contains the API key. */
export const getRacePlanState = (): Promise<RacePlanState | null> =>
  source?.getState() ?? Promise.resolve(null);

export const onRacePlanState = (
  listener: (state: RacePlanState) => void
): (() => void) => source?.onChange(listener) ?? (() => undefined);
