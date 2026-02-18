import type { Meta, StoryObj } from '@storybook/react-vite';

// A static speed bar preview matching the actual PitSpeedBar component
const SpeedBarPreview = ({
  speedKph,
  limitKph,
}: {
  speedKph: number;
  limitKph: number;
}) => {
  const maxSpeed = limitKph * 2;
  const fillPercent =
    (Math.max(0, Math.min(speedKph, maxSpeed)) / maxSpeed) * 100;
  const delta = speedKph - limitKph;
  let fillColor = 'rgb(34, 197, 94)';
  if (delta >= 0) fillColor = 'rgb(239, 68, 68)';
  else if (delta > -5) fillColor = 'rgb(234, 179, 8)';

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-white font-medium tabular-nums leading-none">
        {Math.round(speedKph)}
      </span>
      <div
        className="relative w-8 bg-slate-700/50 rounded overflow-hidden"
        style={{ height: '80px' }}
      >
        <div
          className="absolute bottom-0 w-full"
          style={{ height: `${fillPercent}%`, backgroundColor: fillColor }}
        />
        <div
          className="absolute w-full border-t-2 border-white/70"
          style={{ bottom: '50%' }}
        />
      </div>
      <span className="text-[10px] text-slate-400 leading-none">spd</span>
    </div>
  );
};

// A static countdown bar matching the actual PitCountdownBar vertical component
const CountdownBarPreview = ({
  distance,
  maxDistance,
  color,
  label,
}: {
  distance: number;
  maxDistance: number;
  color: string;
  label: string;
}) => {
  const progress = Math.max(
    0,
    Math.min(100, ((maxDistance - distance) / maxDistance) * 100)
  );
  const valueLabel = distance > 0 ? `${Math.round(distance)}m` : 'here';

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-white font-medium tabular-nums leading-none">
        {valueLabel}
      </span>
      <div
        className="relative w-8 bg-slate-700/50 rounded overflow-hidden"
        style={{ height: '80px' }}
      >
        <div
          className="absolute bottom-0 w-full"
          style={{ height: `${progress}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-slate-400 leading-none">{label}</span>
    </div>
  );
};

// A static input bar matching the actual InputBarColumn component
const InputBarPreview = ({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs text-white font-medium tabular-nums leading-none">
      {Math.round(value * 100)}
    </span>
    <div
      className="relative w-8 bg-slate-700/50 rounded overflow-hidden"
      style={{ height: '80px' }}
    >
      <div
        className="absolute bottom-0 w-full"
        style={{ height: `${value * 100}%`, backgroundColor: color }}
      />
    </div>
    <span className="text-[10px] text-slate-400 leading-none">{label}</span>
  </div>
);

// Shared container for all widget previews
const WidgetContainer = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div>
    <p className="text-sm font-medium mb-2 text-slate-300">{label}</p>
    <div
      className="flex flex-col gap-2 p-2 rounded text-white font-medium"
      style={{ backgroundColor: 'rgb(30 41 59 / 80%)', minWidth: '120px' }}
    >
      {children}
    </div>
  </div>
);

// Speed delta row matching the actual PitlaneHelper Row 1
const SpeedDeltaRow = ({
  delta,
  limit,
  unit,
  isSpeeding,
  isSeverelyOver,
  colorClass,
  showSpeedBar,
  speedKph,
  limitKph,
}: {
  delta: number;
  limit: number;
  unit: 'km/h' | 'mph';
  isSpeeding: boolean;
  isSeverelyOver: boolean;
  colorClass: string;
  showSpeedBar: boolean;
  speedKph: number;
  limitKph: number;
}) => (
  <div className="flex items-end gap-2">
    <div
      className={[
        'flex flex-col justify-center px-2 py-1 rounded',
        isSeverelyOver
          ? 'bg-red-600 animate-pulse'
          : isSpeeding
            ? 'bg-red-600/50'
            : '',
      ].join(' ')}
    >
      <div
        className={[
          'text-2xl font-bold leading-none tabular-nums',
          isSeverelyOver || isSpeeding ? 'text-white' : colorClass,
        ].join(' ')}
      >
        {delta > 0 ? '+' : ''}
        {delta.toFixed(1)}
      </div>
      <div className="text-xs text-slate-400 leading-tight">{unit}</div>
      <div
        className={[
          'text-xs leading-tight',
          isSpeeding ? 'text-white/70' : 'text-slate-500',
        ].join(' ')}
      >
        lim {limit.toFixed(0)}
      </div>
    </div>
    {showSpeedBar && (
      <SpeedBarPreview speedKph={speedKph} limitKph={limitKph} />
    )}
  </div>
);

// Documentation component showing the actual widget states
const PitlaneHelperDocs = () => {
  return (
    <div className="max-w-5xl space-y-6 text-slate-200 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pitlane Helper Widget</h1>
        <p className="text-slate-400">
          Comprehensive pit lane assistance with speed bar, countdown bars, pit
          exit inputs, and warnings. The widget uses a 3-row layout: speed info,
          distance countdown bars, and pedal input bars.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Features</h2>
        <ul className="list-disc list-inside space-y-2 text-sm ml-4">
          <li>
            <strong>Speed Delta Display:</strong> Shows how far over/under the
            pit speed limit you are
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-slate-300">
              <li>Green: Safe (more than 5 km/h under limit)</li>
              <li>Amber: Caution (0–5 km/h under limit)</li>
              <li>Red: Over limit</li>
              <li>
                Flashing Red Box: Severely over (more than 1.5 km/h over limit)
              </li>
            </ul>
          </li>
          <li>
            <strong>Speed Bar:</strong> Vertical bar showing current speed
            relative to the limit; limit marked at the midpoint. Color matches
            the speed delta.
          </li>
          <li>
            <strong>Countdown Bars:</strong> Visual countdown to pit entry,
            pitbox, and pit exit
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-slate-300">
              <li>Color-coded: Green (far) → Yellow (medium) → Blue (close)</li>
              <li>Horizontal or vertical orientation</li>
            </ul>
          </li>
          <li>
            <strong>Pit Exit Inputs:</strong> Clutch and throttle bars for
            optimizing pit exit
          </li>
          <li>
            <strong>Early Pitbox Warning:</strong> Alerts when your pitbox is
            near pit entry (e.g. Daytona)
          </li>
          <li>
            <strong>Pit Limiter Warning:</strong> Flashing warning when entering
            pit without limiter active
          </li>
          <li>
            <strong>Pitlane Traffic:</strong> Shows count of cars ahead and
            behind in pitlane
          </li>
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Example Display States</h2>

        <div className="flex flex-wrap gap-6">
          {/* Approaching pit entry */}
          <WidgetContainer label="Approaching Pit Entry">
            <SpeedDeltaRow
              delta={-8.0}
              limit={72}
              unit="km/h"
              isSpeeding={false}
              isSeverelyOver={false}
              colorClass="text-green-500"
              showSpeedBar={true}
              speedKph={64}
              limitKph={72}
            />
            <div className="flex gap-3">
              <CountdownBarPreview
                distance={150}
                maxDistance={200}
                color="rgb(34, 197, 94)"
                label="Pit Entry"
              />
            </div>
          </WidgetContainer>

          {/* On pit road approaching pitbox */}
          <WidgetContainer label="On Pit Road – Approaching Pitbox">
            <SpeedDeltaRow
              delta={1.0}
              limit={72}
              unit="km/h"
              isSpeeding={true}
              isSeverelyOver={false}
              colorClass="text-white"
              showSpeedBar={true}
              speedKph={73}
              limitKph={72}
            />
            <div className="flex gap-3">
              <CountdownBarPreview
                distance={45}
                maxDistance={100}
                color="rgb(59, 130, 246)"
                label="Pitbox"
              />
            </div>
          </WidgetContainer>

          {/* Severely over limit with limiter warning */}
          <WidgetContainer label="Severely Over Limit">
            <SpeedDeltaRow
              delta={4.2}
              limit={72}
              unit="km/h"
              isSpeeding={true}
              isSeverelyOver={true}
              colorClass="text-white"
              showSpeedBar={true}
              speedKph={76.2}
              limitKph={72}
            />
            <div className="flex gap-3">
              <CountdownBarPreview
                distance={60}
                maxDistance={100}
                color="rgb(234, 179, 8)"
                label="Pitbox"
              />
            </div>
            <div className="text-center text-xs font-bold py-1 px-2 rounded bg-red-700 animate-pulse">
              ACTIVATE LIMITER
            </div>
          </WidgetContainer>

          {/* Past pitbox - approaching pit exit */}
          <WidgetContainer label="Past Pitbox – Approaching Pit Exit">
            <SpeedDeltaRow
              delta={-5.0}
              limit={72}
              unit="km/h"
              isSpeeding={false}
              isSeverelyOver={false}
              colorClass="text-green-500"
              showSpeedBar={true}
              speedKph={67}
              limitKph={72}
            />
            <div className="flex gap-3">
              <CountdownBarPreview
                distance={25}
                maxDistance={100}
                color="rgb(34, 197, 94)"
                label="Past Box"
              />
              <CountdownBarPreview
                distance={80}
                maxDistance={150}
                color="rgb(234, 179, 8)"
                label="Pit Exit"
              />
            </div>
          </WidgetContainer>

          {/* At pitbox with exit inputs */}
          <WidgetContainer label="At Pitbox with Exit Inputs">
            <SpeedDeltaRow
              delta={-2.0}
              limit={72}
              unit="km/h"
              isSpeeding={false}
              isSeverelyOver={false}
              colorClass="text-amber-400"
              showSpeedBar={true}
              speedKph={70}
              limitKph={72}
            />
            <div className="text-center text-xs font-bold py-1 px-2 bg-green-600 rounded">
              At Pitbox
            </div>
            <div className="flex gap-3">
              <InputBarPreview
                value={0.2}
                color="rgb(59, 130, 246)"
                label="clt"
              />
              <InputBarPreview
                value={0.65}
                color="rgb(34, 197, 94)"
                label="thr"
              />
            </div>
          </WidgetContainer>

          {/* Early pitbox + traffic */}
          <WidgetContainer label="Early Pitbox + Traffic">
            <SpeedDeltaRow
              delta={-6.0}
              limit={72}
              unit="km/h"
              isSpeeding={false}
              isSeverelyOver={false}
              colorClass="text-green-500"
              showSpeedBar={true}
              speedKph={66}
              limitKph={72}
            />
            <div className="flex gap-3">
              <CountdownBarPreview
                distance={10}
                maxDistance={100}
                color="rgb(59, 130, 246)"
                label="Pitbox"
              />
            </div>
            <div className="bg-amber-600 text-center text-xs font-bold py-1 px-2 rounded">
              EARLY PITBOX
            </div>
            <div className="bg-blue-700 text-center text-xs py-1 px-2 rounded">
              2 ahead · 1 behind
            </div>
          </WidgetContainer>

          {/* Speed bar only - no countdown bars */}
          <WidgetContainer label="Speed Bar Disabled">
            <SpeedDeltaRow
              delta={-3.5}
              limit={56}
              unit="mph"
              isSpeeding={false}
              isSeverelyOver={false}
              colorClass="text-amber-400"
              showSpeedBar={false}
              speedKph={85}
              limitKph={90}
            />
            <div className="flex gap-3">
              <CountdownBarPreview
                distance={30}
                maxDistance={100}
                color="rgb(59, 130, 246)"
                label="Pitbox"
              />
            </div>
          </WidgetContainer>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Settings</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">Visibility</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li>
                <strong>Show Mode:</strong> Approaching or On Pit Road
              </li>
              <li>
                <strong>Approach Distance:</strong> 100–500m (default: 200m)
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Display</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li>
                <strong>Speed Bar:</strong> On/Off (vertical bar showing speed
                vs limit)
              </li>
              <li>
                <strong>Countdown Bar Orientation:</strong> Horizontal or
                Vertical
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Pit Exit Inputs</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li>
                <strong>Enable:</strong> On/Off
              </li>
              <li>
                <strong>Show Throttle:</strong> On/Off
              </li>
              <li>
                <strong>Show Clutch:</strong> On/Off
              </li>
              <li>
                <strong>Display Phase:</strong> Always / At Pitbox / After
                Pitbox
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Warnings</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li>
                <strong>Pit Limiter Warning:</strong> On/Off
              </li>
              <li>
                <strong>Early Pitbox Warning:</strong> On/Off
              </li>
              <li>
                <strong>Early Threshold:</strong> 25–300m (default: 75m)
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-4 bg-blue-900/30 rounded border border-blue-700">
        <h3 className="text-lg font-semibold text-blue-400">
          Countdown Bar Colors
        </h3>
        <ul className="list-disc list-inside space-y-1 text-sm ml-4 text-slate-300">
          <li>
            <strong className="text-green-400">Green:</strong> More than 50% of
            max distance remaining (far away)
          </li>
          <li>
            <strong className="text-yellow-400">Yellow:</strong> 25–50% of max
            distance remaining (getting closer)
          </li>
          <li>
            <strong className="text-blue-400">Blue:</strong> Less than 25% of
            max distance remaining (very close)
          </li>
        </ul>
      </div>

      <div className="space-y-2 p-4 bg-amber-900/30 rounded border border-amber-700">
        <h3 className="text-lg font-semibold text-amber-400">Pit Detection</h3>
        <ul className="list-disc list-inside space-y-1 text-sm ml-4 text-slate-300">
          <li>
            <strong>Surface 1:</strong> In pitbox (during pit stop)
          </li>
          <li>
            <strong>Surface 2:</strong> In pit blend zone (before pit entry
            line)
          </li>
          <li>
            <strong>OnPitRoad = true:</strong> Past pit entry line (on pit road)
          </li>
          <li>
            <strong>Surface 3:</strong> On track (widget hidden unless
            approaching)
          </li>
        </ul>
      </div>
    </div>
  );
};

const meta: Meta<typeof PitlaneHelperDocs> = {
  title: 'Widgets/PitlaneHelper',
  component: PitlaneHelperDocs,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof PitlaneHelperDocs>;

export const Documentation: Story = {
  name: 'Widget Documentation & Examples',
};
