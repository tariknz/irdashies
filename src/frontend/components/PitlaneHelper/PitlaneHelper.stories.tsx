import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { PitlaneHelperBody } from './PitlaneHelper';

const meta: Meta<typeof PitlaneHelperBody> = {
  title: 'Widgets/PitlaneHelper',
  component: PitlaneHelperBody,
  decorators: [TelemetryDecorator()],
  parameters: {
    layout: 'centered',
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data factories
const mockSpeed = (overrides = {}) => ({
  speedKph: 100,
  speedMph: 62,
  deltaKph: 0,
  deltaMph: 0,
  limitKph: 80,
  limitMph: 50,
  isSpeeding: false,
  isSeverelyOver: false,
  isPulsing: false,
  colorClass: 'text-green-500',
  ...overrides,
} as const);

const mockPosition = (overrides = {}) => ({
  distanceToPitEntry: 500,
  distanceToPit: 100,
  distanceToPitExit: 200,
  isEarlyPitbox: false,
  progressPercent: 0,
  isApproaching: false,
  pitboxPct: 0,
  playerPct: 0,
  ...overrides,
} as const);

const mockConfig = (overrides = {}) => ({
  background: { opacity: 80 },
  showSpeedBar: true,
  speedBarOrientation: 'vertical' as const,
  showProgressBar: true,
  progressBarOrientation: 'horizontal' as const,
  showPastPitBox: true,
  approachDistance: 500,
  showMode: 'approaching' as const,
  earlyPitboxThreshold: 75,
  showPitExitInputs: false,
  pitExitInputs: { throttle: true, clutch: true },
  showInputsPhase: 'always' as const,
  enablePitLimiterWarning: true,
  enableEarlyPitboxWarning: true,
  showPitlaneTraffic: true,
  ...overrides,
} as const);

const mockLimiterWarning = (overrides = {}) => ({
  showWarning: false,
  warningText: '',
  isTeamRaceWarning: false,
  ...overrides,
} as const);

const mockTraffic = (overrides = {}) => ({
  totalCars: 0,
  carsAhead: 0,
  carsBehind: 0,
  ...overrides,
} as const);

// Documentation component showing the actual widget states
export const Documentation = () => {
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

// Approaching pit lane
export const ApproachingPitEntry: Story = {
  render: (args) => (
    <div style={{ height: '300px', width: '200px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ deltaKph: -15, deltaMph: -9 }),
    position: mockPosition({ distanceToPitEntry: 500 }),
    config: mockConfig(),
    displayKph: true,
    onPitRoad: false,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: false,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// Blend zone - entering pit lane
export const BlendZoneEntry: Story = {
  render: (args) => (
    <div style={{ height: '300px', width: '200px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ deltaKph: -20, deltaMph: -12 }),
    position: mockPosition({ distanceToPitEntry: 100 }),
    config: mockConfig(),
    displayKph: true,
    onPitRoad: false,
    inBlendZone: true,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: false,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// On pit road approaching pitbox
export const OnPitRoad: Story = {
  render: (args) => (
    <div style={{ height: '300px', width: '400px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ speedKph: 70, speedMph: 43, deltaKph: -10, deltaMph: -6 }),
    position: mockPosition({ distanceToPit: 80 }),
    config: mockConfig(),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: true,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// At the pitbox
export const AtPitbox: Story = {
  render: (args) => (
    <div style={{ height: '150px', width: '250px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ speedKph: 35, speedMph: 22, deltaKph: -45, deltaMph: -28 }),
    position: mockPosition({ distanceToPit: 0 }),
    config: mockConfig(),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: true,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// Speeding - with inactive inputs
export const SpeedingInactiveInputs: Story = {
  render: (args) => (
    <div style={{ height: '400px', width: '200px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({
      speedKph: 95,
      speedMph: 59,
      deltaKph: 15,
      deltaMph: 9,
      isSpeeding: true,
      colorClass: 'text-red-600',
    }),
    position: mockPosition({ distanceToPit: 80 }),
    config: mockConfig({ showPitExitInputs: true }),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning({
      showWarning: true,
      warningText: 'Pit speed limit violation',
    }),
    shouldShowInputs: false,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// Severely over pit limit - pulsing animation
export const SeverelyOver: Story = {
  render: (args) => (
    <div style={{ height: '350px', width: '250px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({
      speedKph: 115,
      speedMph: 71,
      deltaKph: 35,
      deltaMph: 21,
      isSeverelyOver: true,
      colorClass: 'text-white',
    }),
    position: mockPosition({ distanceToPit: 30 }),
    config: mockConfig(),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning({
      showWarning: true,
      warningText: 'Dangerous pit speed',
      isTeamRaceWarning: true,
    }),
    shouldShowInputs: true,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// Early pitbox warning
export const EarlyPitbox: Story = {
  render: (args) => (
    <div style={{ height: '200px', width: '300px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ speedKph: 50, speedMph: 31, deltaKph: -30, deltaMph: -19 }),
    position: mockPosition({ distanceToPit: 20, isEarlyPitbox: true }),
    config: mockConfig(),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: false,
    showEarlyPitboxWarning: true,
    traffic: mockTraffic(),
  },
};

// With traffic
export const WithTraffic: Story = {
  render: (args) => (
    <div style={{ height: '500px', width: '300px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ speedKph: 75, deltaMph: -5 }),
    position: mockPosition({ distanceToPit: 60 }),
    config: mockConfig({ showPitExitInputs: true }),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: true,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic({ totalCars: 5, carsAhead: 2, carsBehind: 3 }),
  },
};

// Horizontal Speed
export const HorizontalSpeed: Story = {
  render: (args) => (
    <div style={{ height: '250px', width: '200px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({
      speedKph: 100,
      speedMph: 62,
      deltaKph: 0,
      deltaMph: 0,
      limitKph: 80,
      limitMph: 50,
    }),
    position: mockPosition({ distanceToPitEntry: 160 }),
    config: mockConfig({ speedBarOrientation: 'horizontal' }),
    displayKph: false,
    onPitRoad: false,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: false,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// Vertical Progress
export const VerticalProgress: Story = {
  render: (args) => (
    <div style={{ height: '250px', width: '200px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({
      speedKph: 100,
      speedMph: 62,
      deltaKph: 0,
      deltaMph: 0,
      limitKph: 80,
      limitMph: 50,
    }),
    position: mockPosition({ distanceToPitEntry: 160 }),
    config: mockConfig({ progressBarOrientation: 'vertical' }),
    displayKph: false,
    onPitRoad: false,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: false,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};


// Exiting pit lane
export const ExitingPitLane: Story = {
  render: (args) => (
    <div style={{ height: '400px', width: '400px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ speedKph: 120, speedMph: 75, deltaKph: 40, deltaMph: 25 }),
    position: mockPosition({ distanceToPit: -50, distanceToPitExit: 100 }),
    config: mockConfig(),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: false,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};

// Exiting pit lane (with inputs)
export const ExitingWithInputs: Story = {
  render: (args) => (
    <div style={{ height: '400px', width: '400px' }}>
      <PitlaneHelperBody {...args} />
    </div>
  ),
  args: {
    speed: mockSpeed({ speedKph: 120, speedMph: 75, deltaKph: 40, deltaMph: 25 }),
    position: mockPosition({ distanceToPit: -50, distanceToPitExit: 100 }),
    config: mockConfig({ showPitExitInputs: true }),
    displayKph: true,
    onPitRoad: true,
    inBlendZone: false,
    limiterWarning: mockLimiterWarning(),
    shouldShowInputs: true,
    showEarlyPitboxWarning: false,
    traffic: mockTraffic(),
  },
};