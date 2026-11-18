import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps } from 'react';
import type { ReleaseNotesHistoryResult } from '@irdashies/types';
import { releaseNotesFixture } from '@irdashies/types';
import { ReleaseNotesVersions } from './ReleaseNotesVersions';

const history: ReleaseNotesHistoryResult = {
  status: 'ready',
  releases: ['2.1.0', '2.0.0', '1.9.0', '1.8.2', '1.8.1', '1.8.0'].map(
    (version, index) => ({
      version,
      title: `irDashies ${version}`,
      publishedAt: new Date(Date.UTC(2026, 9 - index, 18)).toISOString(),
    })
  ),
  hasMore: true,
  cached: false,
};

const withHistory = (result: ReleaseNotesHistoryResult | null) => () => {
  const previous = window.releaseNotesBridge;
  window.releaseNotesBridge = {
    getStatus: async () => ({
      currentVersion: '2.1.0',
      availableVersion: null,
      pendingVersion: null,
      unreadVersion: null,
      autoShow: false,
      development: false,
      simulation: false,
    }),
    getReleases: (page) =>
      result
        ? Promise.resolve(
            page === 1 || result.status !== 'ready'
              ? result
              : {
                  ...result,
                  releases: [
                    {
                      version: '1.7.0',
                      title: 'irDashies 1.7.0',
                      publishedAt: null,
                    },
                  ],
                  hasMore: false,
                }
          )
        : new Promise(() => undefined),
    getRelease: async (version) => ({
      status: 'ready',
      release: releaseNotesFixture(version),
      cached: false,
    }),
    dismiss: async () => undefined,
    setAutoShow: async () => undefined,
  };
  return () => {
    window.releaseNotesBridge = previous;
  };
};

const VersionsPreview = (args: ComponentProps<typeof ReleaseNotesVersions>) => {
  const [selectedVersion, setSelectedVersion] = useState(args.selectedVersion);
  return (
    <ReleaseNotesVersions
      {...args}
      selectedVersion={selectedVersion}
      onSelect={setSelectedVersion}
    />
  );
};

const meta = {
  title: 'Settings/Release versions',
  component: ReleaseNotesVersions,
  render: (args) => <VersionsPreview {...args} />,
  decorators: [
    (Story) => (
      <div className="flex h-[32rem] bg-slate-900 p-4 text-white">
        <Story />
      </div>
    ),
  ],
  beforeEach: withHistory(history),
  args: {
    currentVersion: '2.1.0',
    availableVersion: null,
    selectedVersion: '2.1.0',
    onSelect: () => undefined,
  },
} satisfies Meta<typeof ReleaseNotesVersions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const DownloadedUpdate: Story = { args: { availableVersion: '2.2.0' } };
export const Loading: Story = { beforeEach: withHistory(null) };
export const Offline: Story = {
  beforeEach: withHistory({ status: 'unavailable', reason: 'offline' }),
};
export const Cached: Story = {
  beforeEach: withHistory({ ...history, cached: true, hasMore: false }),
};
