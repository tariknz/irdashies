import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TrailingSlashRedirect } from './TrailingSlashRedirect';

// The location the settings pages read once the redirect has run.
const PathSeen = ({ openedAt }: { openedAt: string }) => {
  const { pathname, search } = useLocation();
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-slate-400">Opened at</dt>
      <dd className="font-mono">{openedAt}</dd>
      <dt className="text-slate-400">Settings sees</dt>
      <dd className="font-mono">{pathname + search}</dd>
    </dl>
  );
};

const renderAt = (openedAt: string) => (
  <MemoryRouter initialEntries={[openedAt]}>
    <div className="settings-shell bg-slate-900 p-4 text-slate-200">
      <TrailingSlashRedirect>
        <PathSeen openedAt={openedAt} />
      </TrailingSlashRedirect>
    </div>
  </MemoryRouter>
);

const meta: Meta<typeof TrailingSlashRedirect> = {
  component: TrailingSlashRedirect,
  title: 'components/Settings/TrailingSlashRedirect',
};
export default meta;
type Story = StoryObj<typeof TrailingSlashRedirect>;

export const TrailingSlash: Story = {
  render: () => renderAt('/settings/profiles/?tab=1'),
};

export const NoTrailingSlash: Story = {
  render: () => renderAt('/settings/profiles'),
};
