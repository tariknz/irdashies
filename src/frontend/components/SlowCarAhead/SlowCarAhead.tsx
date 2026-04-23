import { useSlowCarAhead } from './hooks/useSlowCarAhead';
import { SlowCarAheadConfig } from '@irdashies/types';
import { useSlowCarAheadSettings } from './hooks/useSlowCarAheadSettings';
import { useSlowCarAheadDemo } from './hooks/useSlowCarAheadDemo';

export const SlowCarAhead = () => {
  const slowCarAhead = useSlowCarAhead();
  const demoSlowCarAhead = useSlowCarAheadDemo();
  const settings = useSlowCarAheadSettings();

  const data = demoSlowCarAhead != null ? demoSlowCarAhead : slowCarAhead;
  if (data === null) {
    return null;
  }

  return (
    <SlowCarAheadDisplay
      isOffTrack={data.isOffTrack}
      isStopped={data.isStopped}
      distance={data.distance}
      settings={settings}
    />
  );
};

export const SlowCarAheadDisplay = ({
  isOffTrack,
  isStopped,
  distance,
  settings,
}: {
  isOffTrack: boolean;
  isStopped: boolean;
  distance: number;
  settings: SlowCarAheadConfig;
}) => {
  let lineColor: string;
  if (isOffTrack) {
    lineColor = 'bg-green-500';
  } else if (isStopped) {
    lineColor = 'bg-red-700';
  } else {
    lineColor = 'bg-amber-500';
  }

  const lineWidthPct = Math.round((1 - distance / settings.maxDistance) * 100);

  return (
    <div className="flex flex-row items-center justify-center gap-1">
      {/*Left line*/}
      <div
        className="w-full grid"
        style={{ height: `${settings.barThickness}px` }}
      >
        <div className={`col-start-1 row-start-1 bg-black/20 rounded-full`} />
        <div
          id="left-line"
          className={`col-start-1 row-start-1 ${lineColor} rounded-full`}
          style={{ width: `${lineWidthPct}%` }}
        />
      </div>
      {/*Distance in the middle*/}
      <div className="bg-black px-2 rounded-full">
        <div className="text-base tabular-nums text-center min-w-[3ch]">
          {Math.round(distance)}
        </div>
      </div>
      {/*Right line*/}
      <div
        className="w-full grid"
        style={{ height: `${settings.barThickness}px` }}
      >
        <div className={`col-start-1 row-start-1 bg-black/20 rounded-full`} />
        <div
          id="right-line"
          className={`col-start-1 row-start-1 ${lineColor} justify-self-end rounded-full`}
          style={{ width: `${lineWidthPct}%` }}
        />
      </div>
    </div>
  );
};
