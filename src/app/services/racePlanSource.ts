import type { ActiveRacePlan, RacePlanService } from './racePlanService';

/**
 * Lets main-process consumers, such as the race plan progress processor, reach
 * the service that `main.ts` creates. Null until the bridge is set up.
 */
let source: Pick<RacePlanService, 'getActivePlan'> | null = null;

export const setRacePlanSource = (
  next: Pick<RacePlanService, 'getActivePlan'> | null
): void => {
  source = next;
};

export const getActiveRacePlan = (): ActiveRacePlan | null =>
  source?.getActivePlan() ?? null;
