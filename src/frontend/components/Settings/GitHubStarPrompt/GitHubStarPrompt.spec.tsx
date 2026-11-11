import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubStarPrompt } from './GitHubStarPrompt';

const state = vi.hoisted(() => ({ running: false }));
vi.mock('@irdashies/context', () => ({
  useRunningState: () => ({ running: state.running }),
}));

const VISITS_KEY = 'irdashies:github-star-prompt:visits';
const DISMISSED_KEY = 'irdashies:github-star-prompt:dismissed';
const FIRST_SEEN_KEY = 'irdashies:github-star-prompt:first-seen';
const DAY_MS = 24 * 60 * 60 * 1000;
let focused = true;
let visibility: DocumentVisibilityState = 'visible';

function idle(ms = 30_000) {
  act(() => vi.advanceTimersByTime(ms));
}

function setVisibility(value: DocumentVisibilityState) {
  visibility = value;
  fireEvent(document, new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T00:00:00Z'));
  localStorage.clear();
  localStorage.setItem(FIRST_SEEN_KEY, String(Date.now() - 2 * DAY_MS));
  state.running = false;
  focused = true;
  visibility = 'visible';
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  vi.spyOn(document, 'hidden', 'get').mockImplementation(
    () => visibility === 'hidden'
  );
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe('GitHub star prompt', () => {
  it('waits a full two days from first use even when five visits are already recorded', () => {
    localStorage.removeItem(FIRST_SEEN_KEY);
    localStorage.setItem(VISITS_KEY, '5');
    const firstSeen = Date.now();
    const view = render(<GitHubStarPrompt />);
    expect(localStorage.getItem(FIRST_SEEN_KEY)).toBe(String(firstSeen));
    idle(DAY_MS);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    view.unmount();
    render(<GitHubStarPrompt />);
    expect(localStorage.getItem(FIRST_SEEN_KEY)).toBe(String(firstSeen));
    idle(DAY_MS - 1);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    idle(1);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('still waits for idle time when the two-day grace period ends during browsing', () => {
    localStorage.setItem(
      FIRST_SEEN_KEY,
      String(Date.now() - 2 * DAY_MS + 10_000)
    );
    localStorage.setItem(VISITS_KEY, '5');
    render(<GitHubStarPrompt />);
    idle(9_000);
    fireEvent.keyDown(window, { key: 'a' });
    idle(29_999);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    idle(1);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it.each(['invalid', '', '-1', 'Infinity', String(Date.UTC(2030, 0, 1))])(
    'starts a fresh grace period for an invalid first-use timestamp: %s',
    (saved) => {
      localStorage.setItem(FIRST_SEEN_KEY, saved);
      localStorage.setItem(VISITS_KEY, '5');
      const now = Date.now();
      render(<GitHubStarPrompt />);
      expect(localStorage.getItem(FIRST_SEEN_KEY)).toBe(String(now));
      idle(DAY_MS);
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    }
  );

  it('counts settings visits across reloads and hidden windows, once under StrictMode', () => {
    let view = render(
      <StrictMode>
        <GitHubStarPrompt />
      </StrictMode>
    );
    expect(localStorage.getItem(VISITS_KEY)).toBe('1');
    for (let visit = 2; visit <= 4; visit++) {
      view.unmount();
      view = render(<GitHubStarPrompt />);
      idle();
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    }
    setVisibility('hidden');
    idle();
    setVisibility('visible');
    expect(localStorage.getItem(VISITS_KEY)).toBe('5');
    idle(29_999);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    idle(1);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    setVisibility('hidden');
    setVisibility('visible');
    expect(localStorage.getItem(VISITS_KEY)).toBe('5');
  });

  it('restarts the idle delay after input and focus, and never shows in the background', () => {
    localStorage.setItem(VISITS_KEY, '4');
    render(<GitHubStarPrompt />);
    idle(29_999);
    fireEvent.keyDown(window, { key: 'a' });
    idle(29_999);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    focused = false;
    fireEvent.blur(window);
    idle();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    focused = true;
    fireEvent.focus(window);
    idle(29_999);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    idle(1);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('waits through simulator sessions and hides an existing prompt on connection', () => {
    localStorage.setItem(VISITS_KEY, '4');
    state.running = true;
    const view = render(<GitHubStarPrompt />);
    idle(60_000);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    state.running = false;
    view.rerender(<GitHubStarPrompt />);
    idle();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    state.running = true;
    view.rerender(<GitHubStarPrompt />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('waits until dialogs are closed before starting another idle delay', () => {
    localStorage.setItem(VISITS_KEY, '4');
    render(<GitHubStarPrompt />);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    idle();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    dialog.remove();
    fireEvent.pointerDown(window);
    idle();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it.each(['Dismiss', 'Star on GitHub'])(
    'permanently dismisses via %s without stealing focus',
    (name) => {
      localStorage.setItem(VISITS_KEY, '4');
      const view = render(
        <>
          <button>Settings control</button>
          <GitHubStarPrompt />
        </>
      );
      const control = screen.getByRole('button', { name: 'Settings control' });
      control.focus();
      idle();
      expect(control).toHaveFocus();
      const link = screen.getByRole('link', { name: 'Star on GitHub' });
      expect(link).toHaveAttribute(
        'href',
        'https://github.com/tariknz/irdashies'
      );
      expect(link).toHaveAttribute('target', '_blank');
      const action =
        name === 'Star on GitHub' ? link : screen.getByRole('button', { name });
      // jsdom cannot follow external links; still execute the real click handler.
      action.addEventListener('click', (event) => event.preventDefault());
      fireEvent.click(action);
      expect(localStorage.getItem(DISMISSED_KEY)).toBe('true');
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      view.unmount();
      render(<GitHubStarPrompt />);
      idle(60_000);
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    }
  );

  it.each(['getItem', 'setItem'] as const)(
    'does not ask if storage %s fails',
    (method) => {
      localStorage.setItem(VISITS_KEY, '4');
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      render(<GitHubStarPrompt />);
      idle();
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    }
  );

  it('does not count a settings window that starts hidden until it is opened', () => {
    visibility = 'hidden';
    render(<GitHubStarPrompt />);
    idle();
    expect(localStorage.getItem(VISITS_KEY)).toBeNull();
    setVisibility('visible');
    expect(localStorage.getItem(VISITS_KEY)).toBe('1');
  });

  it('honors a dismissal from another window while waiting or showing', () => {
    localStorage.setItem(VISITS_KEY, '4');
    render(<GitHubStarPrompt />);
    idle();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    fireEvent(
      window,
      new StorageEvent('storage', { key: DISMISSED_KEY, newValue: 'true' })
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    fireEvent.pointerDown(window);
    idle();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('cancels the idle timer when settings unmounts', () => {
    localStorage.setItem(VISITS_KEY, '4');
    const view = render(<GitHubStarPrompt />);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
