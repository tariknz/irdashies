import { useMemo } from 'react';
import {
  useDashboard,
  useRacePlanProgressSnapshot,
  useRacePlanState,
} from '@irdashies/context';
import {
  buildStintPlanView,
  demoRacePlanSnapshot,
  demoRacePlanState,
  mismatchText,
  progressNotice,
} from '@irdashies/domain';
import type { StintPlanConfig } from '@irdashies/types';
import {
  BoxRow,
  DriftRow,
  FuelRow,
  NextRow,
  StintHeader,
  StintPlanBanner,
  StintPlanFrame,
  StintPlanNotice,
} from './components/StintPlanRows';

export type StintPlanProps = Partial<StintPlanConfig> & { embedded?: boolean };

const DEMO_SNAPSHOT = demoRacePlanSnapshot({ driftSec: 134 });

export const StintPlan = ({
  background,
  showElapsedTime = true,
  showFuel = true,
  showNextDriver = true,
}: StintPlanProps) => {
  const { isDemoMode } = useDashboard();
  const liveSnapshot = useRacePlanProgressSnapshot();
  const livePlan = useRacePlanState();
  const snapshot = isDemoMode ? DEMO_SNAPSHOT : liveSnapshot;
  const planState = isDemoMode ? demoRacePlanState : livePlan;

  const view = useMemo(
    () =>
      snapshot
        ? buildStintPlanView(snapshot, planState, {
            showElapsed: showElapsedTime,
          })
        : null,
    [snapshot, planState, showElapsedTime]
  );

  const opacity = background?.opacity ?? 80;
  const notice = progressNotice(snapshot);
  if (notice || !snapshot || !view) {
    return (
      <StintPlanFrame opacity={opacity}>
        <StintPlanNotice
          title={notice?.title ?? 'Waiting for race plan data'}
          hint={notice?.hint ?? null}
        />
      </StintPlanFrame>
    );
  }

  const mismatch = mismatchText(snapshot.mismatches);
  const racing = snapshot.status === 'racing';
  const next =
    showNextDriver && view.nextDriverName && view.nextStart ? (
      <NextRow
        label={view.nextLabel ?? 'Next'}
        driverName={view.nextDriverName}
        start={view.nextStart}
      />
    ) : null;

  return (
    <StintPlanFrame opacity={opacity}>
      {mismatch && <StintPlanBanner text={mismatch} />}
      {snapshot.status === 'waiting' ? (
        <>
          <StintHeader
            stintLabel="Waiting for the green flag"
            driverName={null}
            clashes={view.clashes.clashes}
            warnings={view.clashes.warnings}
            text={view.clashes.text}
          />
          {next}
        </>
      ) : (
        <>
          <StintHeader
            stintLabel={racing ? view.stintLabel : 'Race finished'}
            driverName={racing ? view.driverName : null}
            clashes={racing ? view.clashes.clashes : 0}
            warnings={racing ? view.clashes.warnings : 0}
            text={view.clashes.text}
          />
          {racing && (
            <BoxRow
              lapLabel={view.lapLabel}
              boxKind={view.boxKind}
              boxLabel={view.boxLabel}
            />
          )}
          {racing && showFuel && view.fuelVisible && (
            <FuelRow
              target={view.fuelTarget}
              actual={view.fuelActual}
              level={view.fuelLevel}
            />
          )}
          {racing && next}
          {view.driftText && (
            <DriftRow text={view.driftText} level={view.driftLevel} />
          )}
        </>
      )}
    </StintPlanFrame>
  );
};
