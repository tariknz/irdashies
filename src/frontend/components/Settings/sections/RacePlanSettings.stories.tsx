import { Meta, StoryObj } from '@storybook/react-vite';
import type {
  RacePlanBridge,
  RacePlanListing,
  RacePlanning,
  RacePlanState,
} from '@irdashies/types';
import { RacePlanSettings } from './RacePlanSettings';

const RACE_START_MS = Date.parse('2030-06-01T12:00:00Z');
const DRIVER_IDS = [101, 102, 103, 104, 105, 106];

/** Made-up 24h planning: six drivers, 23 stints, the last one unassigned. */
const planning: RacePlanning = {
  source: 'iraceplan',
  id: 9001,
  sessionName: 'Test 24',
  car: 'Test Car',
  teamId: 5001,
  trackId: 166,
  trackName: 'Test Circuit',
  updatedAt: '2030-05-02T12:00:00Z',
  drivers: DRIVER_IDS.map((iracingId, i) => ({
    iracingId,
    name: `Driver ${String.fromCharCode(65 + i)}`,
    availability: [],
  })),
  strategies: [
    {
      id: 7001,
      name: 'Main',
      raceStartMs: RACE_START_MS,
      fuelCapacity: 36,
      pitStopMs: 50_000,
      updatedAt: '2030-05-02T12:00:00Z',
      drivers: [],
      stints: Array.from({ length: 23 }, (_, i) => ({
        number: i + 1,
        driverId: i === 22 ? null : DRIVER_IDS[i % 6],
        startSec: i * 3_710,
        endSec: i * 3_710 + 3_660,
        laps: 34,
        setup: 'dry' as const,
        fuel: 35.7,
        locked: false,
      })),
    },
    {
      id: 7002,
      name: 'Double stints',
      raceStartMs: RACE_START_MS,
      fuelCapacity: 36,
      pitStopMs: 78_000,
      updatedAt: '2030-05-02T12:00:00Z',
      drivers: [],
      stints: [],
    },
  ],
};

const listings: RacePlanListing[] = [
  {
    id: 9001,
    name: 'Test 24',
    car: 'Test Car',
    isTeam: true,
    trackName: 'Test Circuit',
    startAt: '2030-06-01T11:00:00Z',
  },
  {
    id: 9002,
    name: 'Weekly sprint',
    car: 'Test Car',
    isTeam: false,
    trackName: 'Other Circuit',
    startAt: '2030-05-20T19:00:00Z',
  },
];

const baseState: RacePlanState = {
  config: { planningId: null, strategyId: null, refreshMinutes: 5 },
  hasApiKey: false,
  canStoreApiKey: true,
  status: 'idle',
  fetchedAt: null,
  planning: null,
  strategyId: null,
};

/** Keeps state in memory so changes stick while the story is open. */
const mockBridge = (initial: RacePlanState): RacePlanBridge => {
  let state = initial;
  const listeners = new Set<(s: RacePlanState) => void>();
  const update = (next: Partial<RacePlanState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
    return Promise.resolve(state);
  };
  return {
    getState: () => Promise.resolve(state),
    // Only the listed plannings exist, so a typed ID like 1234 shows the
    // not-found message.
    choosePlanning: (planningId) => {
      if (planningId !== null && planningId !== planning.id)
        return Promise.resolve({ status: 'not-found' });
      return update({
        config: { ...state.config, planningId, strategyId: null },
        planning: planningId === null ? null : planning,
        strategyId: planningId === null ? null : planning.strategies[0].id,
        status: planningId === null ? 'idle' : 'ok',
        fetchedAt: planningId === null ? null : Date.now(),
      }).then((next) => ({ status: 'ok', state: next }));
    },
    setConfig: (config) => update({ config: { ...state.config, ...config } }),
    setApiKey: () => update({ hasApiKey: true }),
    clearApiKey: () => update({ hasApiKey: false }),
    listPlannings: () => Promise.resolve({ status: 'ok', plannings: listings }),
    refreshNow: () => update({ fetchedAt: Date.now() }),
    onStateChanged: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
};

const meta: Meta<typeof RacePlanSettings> = {
  component: RacePlanSettings,
  title: 'components/Settings/RacePlanSettings',
  decorators: [
    (Story) => (
      <div className="h-screen w-full max-w-3xl overflow-y-auto text-white">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof RacePlanSettings>;

export const NoKey: Story = {
  args: { bridge: mockBridge(baseState) },
};

export const Loaded: Story = {
  args: {
    bridge: mockBridge({
      ...baseState,
      config: { planningId: 9001, strategyId: 7001, refreshMinutes: 5 },
      hasApiKey: true,
      status: 'ok',
      fetchedAt: RACE_START_MS - 3_600_000,
      planning,
      strategyId: 7001,
    }),
  },
};

export const FetchErrorWithSavedPlan: Story = {
  args: {
    bridge: mockBridge({
      ...baseState,
      config: { planningId: 9001, strategyId: null, refreshMinutes: 5 },
      hasApiKey: true,
      status: 'network',
      fetchedAt: RACE_START_MS - 3_600_000,
      planning,
      strategyId: 7001,
    }),
  },
};

export const RejectedKey: Story = {
  args: {
    bridge: mockBridge({
      ...baseState,
      config: { planningId: 9001, strategyId: null, refreshMinutes: 5 },
      hasApiKey: true,
      status: 'unauthorized',
    }),
  },
};

export const CannotStoreKey: Story = {
  args: { bridge: mockBridge({ ...baseState, canStoreApiKey: false }) },
};
