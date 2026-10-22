import type {
  RacePlanMismatch,
  RacePlanProgressSnapshot,
} from '@irdashies/types';

export const NO_PLAN_HINT = 'Set up a race plan in Settings → Race Plan';

export interface RacePlanNotice {
  kind: 'loading' | 'no-plan' | 'replay';
  title: string;
  hint: string | null;
}

/**
 * What to show instead of the plan, or null when there is a plan to show.
 * Waiting and finished still show the plan.
 */
export const progressNotice = (
  snapshot: Pick<RacePlanProgressSnapshot, 'status'> | undefined
): RacePlanNotice | null => {
  if (!snapshot) {
    return { kind: 'loading', title: 'Waiting for race plan data', hint: null };
  }
  switch (snapshot.status) {
    case 'no-plan':
      return {
        kind: 'no-plan',
        title: 'No race plan loaded',
        hint: NO_PLAN_HINT,
      };
    case 'replay':
      return {
        kind: 'replay',
        title: 'Race plan is not tracked in replays',
        hint: null,
      };
    default:
      return null;
  }
};

/** "This plan is for a different team and track"; null when it matches. */
export const mismatchText = (
  mismatches: readonly RacePlanMismatch[]
): string | null => {
  const team = mismatches.includes('team');
  const track = mismatches.includes('track');
  if (!team && !track) return null;
  const what = team && track ? 'team and track' : team ? 'team' : 'track';
  return `This plan is for a different ${what}`;
};
