import { useMemo } from 'react';
import {
  useDashboard,
  useDriverUserId,
  useRacePlanProgressSnapshot,
  useRacePlanState,
} from '@irdashies/context';
import {
  DEMO_DRIVER_IDS,
  buildStrategyTimelineView,
  demoRacePlanSnapshot,
  demoRacePlanState,
  demoRepairStop,
  mismatchText,
  progressNotice,
} from '@irdashies/domain';
import type { StrategyTimelineConfig } from '@irdashies/types';
import { StintRow } from './components/StintRow';
import { TimelineStrip } from './components/TimelineStrip';
import {
  StopsList,
  TimelineBanner,
  TimelineFrame,
  TimelineHeader,
  TimelineNotice,
} from './components/TimelineParts';

export type StrategyTimelineProps = Partial<StrategyTimelineConfig> & {
  embedded?: boolean;
};

const DEMO_SNAPSHOT = demoRacePlanSnapshot({
  driftSec: 134,
  rebuiltFrom: 4,
  stops: [demoRepairStop],
});
const DEMO_USER_ID = DEMO_DRIVER_IDS[1];

export const StrategyTimeline = ({
  background,
  showElapsedTime = true,
  showStrip = true,
  showDoneStints = true,
  showStops = true,
}: StrategyTimelineProps) => {
  const { isDemoMode } = useDashboard();
  const liveSnapshot = useRacePlanProgressSnapshot();
  const livePlan = useRacePlanState();
  const liveUserId = useDriverUserId();
  const snapshot = isDemoMode ? DEMO_SNAPSHOT : liveSnapshot;
  const planState = isDemoMode ? demoRacePlanState : livePlan;
  const userId = isDemoMode ? DEMO_USER_ID : liveUserId;

  const view = useMemo(
    () =>
      snapshot
        ? buildStrategyTimelineView(snapshot, planState, userId, {
            showElapsed: showElapsedTime,
            showDoneStints,
          })
        : null,
    [snapshot, planState, userId, showElapsedTime, showDoneStints]
  );

  const opacity = background?.opacity ?? 80;
  const notice = progressNotice(snapshot);
  if (notice || !snapshot || !view) {
    return (
      <TimelineFrame opacity={opacity}>
        <TimelineNotice
          title={notice?.title ?? 'Waiting for race plan data'}
          hint={notice?.hint ?? null}
        />
      </TimelineFrame>
    );
  }

  const mismatch = mismatchText(snapshot.mismatches);
  const title =
    snapshot.status === 'waiting'
      ? (view.header ?? 'Waiting for the green flag')
      : snapshot.status === 'finished'
        ? 'Race finished'
        : view.header;

  return (
    <TimelineFrame opacity={opacity}>
      {mismatch && <TimelineBanner text={mismatch} />}
      <TimelineHeader
        title={title}
        driftText={view.driftText}
        driftLevel={view.driftLevel}
      />
      {showStrip && (
        <TimelineStrip
          strip={view.strip}
          startLabel={view.stripStart}
          endLabel={view.stripEnd}
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-800 text-slate-400">
            <tr>
              <th className="px-1 text-right font-normal">#</th>
              <th className="px-1 font-normal">Driver</th>
              <th className="hidden px-1 font-normal @sm:table-cell">
                Planned
              </th>
              <th className="px-1 font-normal">Projected</th>
              <th className="hidden px-1 font-normal @2xs:table-cell">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <StintRow
                key={row.number}
                number={row.number}
                driverName={row.driverName}
                mine={row.mine}
                status={row.status}
                plannedStart={row.plannedStart}
                projectedStart={row.projectedStart}
                rebuilt={row.rebuilt}
                clashLevel={row.clashLevel}
                clashText={row.clashText}
              />
            ))}
          </tbody>
        </table>
      </div>
      {showStops && <StopsList stops={view.stops} />}
    </TimelineFrame>
  );
};
