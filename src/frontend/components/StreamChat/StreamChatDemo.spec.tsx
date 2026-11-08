import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useStreamChatEmotes,
  useStreamChatMessagesSnapshot,
} from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { StreamChat } from './StreamChat';

const mode = vi.hoisted(() => ({ isDemoMode: true }));
vi.mock('@irdashies/context', () => ({
  useDashboard: () => mode,
  useStreamChatMessagesSnapshot: vi.fn(() => null),
  useStreamChatEmotes: vi.fn(() => ({
    global: new Map(),
    channels: new Map(),
  })),
}));
vi.mock('./hooks/useStreamChatSettings', () => ({
  useStreamChatSettings: () => ({
    enabled: true,
    config: getWidgetDefaultConfig('streamchat'),
  }),
}));

afterEach(() => vi.useRealTimers());

describe('Stream Chat demo', () => {
  it('seeds messages without connected accounts or live subscriptions, then cleans up on returning live', () => {
    vi.useFakeTimers();
    mode.isDemoMode = true;
    const { rerender, unmount } = render(<StreamChat />);
    expect(screen.getByText('SpeedDemon99')).toBeInTheDocument();
    expect(useStreamChatMessagesSnapshot).not.toHaveBeenCalled();
    expect(useStreamChatEmotes).not.toHaveBeenCalled();
    mode.isDemoMode = false;
    rerender(<StreamChat />);
    expect(screen.queryByText('SpeedDemon99')).toBeNull();
    expect(useStreamChatMessagesSnapshot).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
});
