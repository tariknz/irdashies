import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSessionStore } from '@irdashies/context';
import type {
  DashboardLayout,
  DriverTagSettings,
  Session,
} from '@irdashies/types';
import { useDriverTagMap } from './useDriverTagMap';

let currentDashboard: DashboardLayout;
vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ currentDashboard }),
}));

afterEach(() => useSessionStore.getState().resetSession());

it('resolves explicit driver entries and ignores old mappings', () => {
  const driverTagSettings = {
    entries: [
      { name: 'Morgan Lee', groupId: 'friend', label: 'Captain' },
      { id: '789', groupId: 'friend' },
      { name: 'Jamie Taylor', groupId: 'team' },
    ],
    groups: [{ id: 'team', name: 'Team', color: 0xff0000 }],
    display: { enabled: true },
    mapping: { '456': 'team' },
  } satisfies DriverTagSettings & { mapping: Record<string, string> };
  currentDashboard = {
    widgets: [],
    generalSettings: { driverTagSettings },
  };
  useSessionStore.getState().setSession({
    DriverInfo: {
      Drivers: [
        { CarIdx: 0, UserID: 123, UserName: 'morgan lee' },
        { CarIdx: 1, UserID: 456, UserName: 'Alex Smith' },
        { CarIdx: 2, UserID: 789, UserName: 'Jamie Taylor' },
      ],
    },
  } as Session);

  const { result } = renderHook(() => useDriverTagMap(true));

  expect(result.current.tagMap.get(0)).toMatchObject({
    id: 'friend',
    label: 'Captain',
  });
  expect(result.current.tagMap.get(1)).toBeUndefined();
  expect(result.current.tagMap.get(2)?.id).toBe('friend');
});
