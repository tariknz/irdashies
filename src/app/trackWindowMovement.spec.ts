import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import {
  markCorrectedBounds,
  trackSettingsWindowMovement,
} from './trackWindowMovement';
import { writeData } from './storage/storage';

vi.mock('./storage/storage', () => ({ writeData: vi.fn() }));

const DEBOUNCE_MS = 200;

/**
 * Minimal stand-in for the parts of BrowserWindow this module uses: it records
 * the handlers registered for 'moved' and 'resized' so a test can raise them,
 * and returns whatever bounds the test last set.
 */
function fakeWindow(initial: Electron.Rectangle) {
  const handlers: Record<string, (() => void)[]> = {};
  let bounds = initial;

  const win = {
    on: (event: string, handler: () => void) => {
      (handlers[event] ??= []).push(handler);
      return win;
    },
    getBounds: () => bounds,
  };

  return {
    win: win as unknown as BrowserWindow,
    setBounds: (next: Electron.Rectangle) => {
      bounds = next;
    },
    emit: (event: string) => (handlers[event] ?? []).forEach((h) => h()),
  };
}

const ON_SCREEN = { x: 100, y: 100, width: 800, height: 700 };
const OFF_SCREEN = { x: -20000, y: 250, width: 800, height: 700 };
const RESCUED = { x: 622, y: 200, width: 800, height: 700 };

describe('trackSettingsWindowMovement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(writeData).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves bounds after the user moves the window', () => {
    const { win, setBounds, emit } = fakeWindow(ON_SCREEN);
    trackSettingsWindowMovement(win);

    setBounds({ ...ON_SCREEN, x: 300 });
    emit('moved');
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(writeData).toHaveBeenCalledWith('settingsWindowBounds', {
      ...ON_SCREEN,
      x: 300,
    });
  });

  it('saves bounds after the user resizes the window', () => {
    const { win, setBounds, emit } = fakeWindow(ON_SCREEN);
    trackSettingsWindowMovement(win);

    setBounds({ ...ON_SCREEN, width: 900 });
    emit('resized');
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(writeData).toHaveBeenCalledOnce();
  });

  it('debounces a burst of events into one save', () => {
    const { win, setBounds, emit } = fakeWindow(ON_SCREEN);
    trackSettingsWindowMovement(win);

    setBounds({ ...ON_SCREEN, x: 200 });
    emit('moved');
    emit('moved');
    emit('moved');
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(writeData).toHaveBeenCalledOnce();
  });

  it('does not persist a position the app corrected to', () => {
    // The window was saved off-screen, so startup rescues it. That rescue must
    // not overwrite the saved position, or reconnecting the monitor would no
    // longer bring the window back to where the user had put it.
    const { win, setBounds, emit } = fakeWindow(OFF_SCREEN);
    trackSettingsWindowMovement(win);

    markCorrectedBounds(win, RESCUED);
    setBounds(RESCUED);
    // Raised explicitly. Electron does not currently emit these for a
    // programmatic setBounds, so the saved position survives today by accident;
    // this asserts it survives even if that changes.
    emit('moved');
    emit('resized');
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(writeData).not.toHaveBeenCalled();
  });

  it('resumes saving once the user moves the window themselves', () => {
    const { win, setBounds, emit } = fakeWindow(OFF_SCREEN);
    trackSettingsWindowMovement(win);

    markCorrectedBounds(win, RESCUED);
    setBounds(RESCUED);
    emit('moved');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(writeData).not.toHaveBeenCalled();

    // The user drags it somewhere of their own choosing.
    const chosen = { ...RESCUED, x: 900, y: 400 };
    setBounds(chosen);
    emit('moved');
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(writeData).toHaveBeenCalledWith('settingsWindowBounds', chosen);
  });

  it('only suppresses the window that was corrected', () => {
    const a = fakeWindow(ON_SCREEN);
    const b = fakeWindow(ON_SCREEN);
    trackSettingsWindowMovement(a.win);
    trackSettingsWindowMovement(b.win);

    markCorrectedBounds(a.win, RESCUED);
    a.setBounds(RESCUED);
    b.setBounds(RESCUED);

    a.emit('moved');
    b.emit('moved');
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(writeData).toHaveBeenCalledOnce();
    expect(writeData).toHaveBeenCalledWith('settingsWindowBounds', RESCUED);
  });
});
