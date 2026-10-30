import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { StreamChatMessage } from '@irdashies/types';
import { ChatMessageList } from './StreamChat';

const message = (overrides: Partial<StreamChatMessage>): StreamChatMessage => ({
  id: 'm',
  platform: 'twitch',
  channel: 'streamer',
  timestamp: 1,
  user: 'Viewer',
  text: 'hello',
  emotes: [],
  ...overrides,
});

const renderList = (
  messages: StreamChatMessage[],
  showPlatformIcons: boolean
) =>
  render(
    <ChatMessageList
      messages={messages}
      fontSize={16}
      background={{ opacity: 50 }}
      showPlatformIcons={showPlatformIcons}
    />
  );

describe('ChatMessageList', () => {
  it('shows messages in the order given', () => {
    renderList(
      [
        message({ id: '1', user: 'First', text: 'one' }),
        message({ id: '2', platform: 'youtube', user: 'Second', text: 'two' }),
      ],
      false
    );
    const text = document.body.textContent ?? '';
    expect(text.indexOf('First')).toBeLessThan(text.indexOf('Second'));
  });

  it('marks the platform of each message when icons are on', () => {
    renderList(
      [
        message({ id: '1' }),
        message({ id: '2', platform: 'youtube', user: 'Other' }),
      ],
      true
    );
    expect(screen.getByLabelText('Twitch')).toBeTruthy();
    expect(screen.getByLabelText('YouTube')).toBeTruthy();
  });

  it('leaves the icons out when they are off', () => {
    renderList([message({ id: '1' })], false);
    expect(screen.queryByLabelText('Twitch')).toBeNull();
  });

  it('renders YouTube emoji and badges', () => {
    renderList(
      [
        message({
          platform: 'youtube',
          segments: [
            { type: 'text', text: 'go ' },
            { type: 'emoji', url: 'https://example.test/e.png', alt: ':fire:' },
          ],
          badges: [{ kind: 'moderator', label: 'Moderator' }],
        }),
      ],
      false
    );
    expect(screen.getByAltText(':fire:').getAttribute('src')).toBe(
      'https://example.test/e.png'
    );
    expect(screen.getByLabelText('Moderator')).toBeTruthy();
  });

  it('uses the member badge image when one is provided', () => {
    renderList(
      [
        message({
          platform: 'youtube',
          segments: [{ type: 'text', text: 'hi' }],
          badges: [
            {
              kind: 'member',
              label: 'Member',
              imageUrl: 'https://example.test/b.png',
            },
          ],
        }),
      ],
      false
    );
    expect(screen.getByAltText('Member').getAttribute('src')).toBe(
      'https://example.test/b.png'
    );
  });

  describe('auto-hide', () => {
    afterEach(() => vi.useRealTimers());

    const renderAutoHide = (messages: StreamChatMessage[]) =>
      render(
        <ChatMessageList
          messages={messages}
          fontSize={16}
          background={{ opacity: 50 }}
          autoHide={{ enabled: true, intervalSeconds: 10 }}
        />
      );

    it('removes a replayed message that already expired without waiting a new interval', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000_000);
      renderAutoHide([
        message({ id: 'old', text: 'stale', timestamp: 1_000_000 - 600_000 }),
      ]);
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.queryByText('stale')).toBeNull();
    });

    it('hides a message only for the time left of its interval', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000_000);
      renderAutoHide([
        message({ id: 'new', text: 'fresh', timestamp: 1_000_000 - 7_000 }),
      ]);
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(screen.getByText(/fresh/)).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1_000 + 1_000);
      });
      expect(screen.queryByText(/fresh/)).toBeNull();
    });
  });
});
