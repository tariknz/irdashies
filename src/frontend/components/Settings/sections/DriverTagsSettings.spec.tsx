import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DriverTagSettings } from '@irdashies/types';
import { DriverTagsSettings } from './DriverTagsSettings';

const legacyTags: DriverTagSettings = {
  groups: [],
  entries: [
    { name: 'Morgan Lee', groupId: 'friend', label: 'Captain' },
    { id: '123', groupId: 'twitch', legacyMapping: true },
    { id: '456', groupId: 'youtube', legacyMapping: true },
  ],
  mapping: {},
  display: { enabled: true },
};

const { saveDriverTagSettings } = vi.hoisted(() => ({
  saveDriverTagSettings: vi
    .fn<(settings: DriverTagSettings) => Promise<void>>()
    .mockResolvedValue(undefined),
}));

const bridge = {
  getDriverTagSettings: async () => legacyTags,
  saveDriverTagSettings,
};

vi.mock('@irdashies/context', () => ({ useDashboard: () => ({ bridge }) }));

beforeEach(() => saveDriverTagSettings.mockClear());

it.each(['label', 'group'] as const)(
  'promotes only the migrated driver whose %s was edited',
  async (field) => {
    const user = userEvent.setup();
    render(<DriverTagsSettings />);
    await screen.findByDisplayValue('123');

    if (field === 'label') {
      const label = screen.getAllByRole('textbox', { name: 'Driver label' })[1];
      await user.type(label, 'Teammate{Enter}');
    } else {
      await user.click(
        screen.getByRole('button', { name: 'Driver group for 123' })
      );
      const options = screen.getByRole('group', {
        name: 'Driver group for 123 options',
      });
      await user.click(
        within(options).getByRole('button', { name: 'YouTube' })
      );
    }

    expect(saveDriverTagSettings).toHaveBeenCalledOnce();
    expect(saveDriverTagSettings.mock.lastCall?.[0].entries).toEqual([
      { name: 'Morgan Lee', groupId: 'friend', label: 'Captain' },
      field === 'label'
        ? { id: '123', groupId: 'twitch', label: 'Teammate' }
        : { id: '123', groupId: 'youtube' },
      { id: '456', groupId: 'youtube', legacyMapping: true },
    ]);
  }
);

it('keeps migrated priority when the user reselects the same group or re-enters the same ID', async () => {
  const user = userEvent.setup();
  render(<DriverTagsSettings />);
  const id = await screen.findByDisplayValue('123');
  await user.clear(id);
  await user.type(id, '123{Enter}');
  await user.click(
    screen.getByRole('button', { name: 'Driver group for 123' })
  );
  const options = screen.getByRole('group', {
    name: 'Driver group for 123 options',
  });
  await user.click(within(options).getByRole('button', { name: 'Twitch' }));

  expect(saveDriverTagSettings).not.toHaveBeenCalled();
});
