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

it.each<Pick<DriverTagSettings, 'entries' | 'mapping'>>([
  {
    entries: [{ name: 'Morgan Lee', groupId: 'friend', label: 'Captain' }],
    mapping: { '123': 'team', '456': 'team', '789': 'team' },
  },
  {
    entries: [
      { name: 'Morgan Lee', groupId: 'friend', label: 'Captain' },
      { id: '123', groupId: 'team', legacyMapping: true },
      { id: '456', groupId: 'team', legacyMapping: true },
      { id: '789', groupId: 'team', legacyMapping: true },
    ],
    mapping: {},
  },
])(
  'keeps legacy mappings as fallbacks before and after migration',
  (assignments) => {
    currentDashboard = {
      widgets: [],
      generalSettings: {
        driverTagSettings: {
          ...assignments,
          groups: [{ id: 'team', name: 'Team', color: 0xff0000 }],
          display: { enabled: true },
        },
      },
    };
    useSessionStore.getState().setSession({
      DriverInfo: {
        Drivers: [
          { CarIdx: 0, UserID: 123, UserName: 'morgan lee' },
          { CarIdx: 1, UserID: 456, UserName: 'Alex Smith' },
          { CarIdx: 2, UserID: 900, UserName: '789' },
        ],
      },
    } as Session);

    const { result } = renderHook(() => useDriverTagMap(true));

    expect(result.current.tagMap.get(0)).toMatchObject({
      id: 'friend',
      label: 'Captain',
    });
    expect(result.current.tagMap.get(1)?.id).toBe('team');
    expect(result.current.tagMap.get(2)?.id).toBe('team');
  }
);
