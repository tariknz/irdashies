import { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import type { DashboardBridge, SessionProfileMap } from '@irdashies/types';
import { ProfileSettings } from './ProfileSettings';

const profiles = [
  { id: 'default', name: 'Default' },
  { id: 'quali-clean', name: 'Qualifying' },
  { id: 'race-full', name: 'Race' },
  { id: 'spotter-view', name: 'Spotting' },
].map((profile) => ({
  ...profile,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastModified: '2026-01-01T00:00:00.000Z',
}));

/**
 * Holds the mapping in memory so selections stick while the story is open,
 * the way they do against real storage.
 */
const bridgeWithProfiles = (initial: SessionProfileMap): DashboardBridge => {
  let map: SessionProfileMap = { ...initial };
  return {
    ...mockDashboardBridge,
    listProfiles: () => Promise.resolve(profiles),
    getSessionProfileMap: () => Promise.resolve(map),
    setSessionProfileMap: (next: SessionProfileMap) => {
      map = next;
      return Promise.resolve();
    },
  };
};

const meta: Meta<typeof ProfileSettings> = {
  component: ProfileSettings,
  title: 'components/Settings/ProfileSettings',
};

export default meta;

type Story = StoryObj<typeof ProfileSettings>;

// No TelemetryDecorator here: it supplies its own DashboardProvider bound to
// the shared mock bridge, and as the innermost decorator that provider would
// shadow this one — leaving the story with the mock's single profile and no
// session mapping. This section reads dashboard context only, so its provider
// is all it needs.
const withBridge = (map: SessionProfileMap): Story['decorators'] => [
  (Story) => (
    <DashboardProvider bridge={bridgeWithProfiles(map)}>
      <div style={{ height: '100vh', width: '700px', overflowY: 'auto' }}>
        <Story />
      </div>
    </DashboardProvider>
  ),
];

/** How the mapping looks before the user has configured anything. */
export const Default: Story = {
  decorators: withBridge({}),
};

/** A configured event: a layout per session, plus one for spotting. */
export const SessionMappingConfigured: Story = {
  decorators: withBridge({
    practice: 'default',
    openQualify: 'quali-clean',
    race: 'race-full',
    spotting: 'spotter-view',
  }),
};
