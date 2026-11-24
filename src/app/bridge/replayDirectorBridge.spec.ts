import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayDirectorRuntime } from '../processors/replayDirectorRuntime';

const handlers = new Map<string, () => Promise<void>>();
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((name, handler) => handlers.set(name, handler)) },
}));

import { setupReplayDirectorBridge } from './replayDirectorBridge';

describe('replayDirectorBridge', () => {
  beforeEach(() => handlers.clear());

  it.each(['backToProgram', 'resumeAtCut', 'stayHere'] as const)(
    'delegates %s through its registered IPC handler',
    async (method) => {
      const promise = Promise.resolve();
      const runtime = {
        backToProgram: vi.fn(() => promise),
        resumeAtCut: vi.fn(() => promise),
        stayHere: vi.fn(() => promise),
      };
      setupReplayDirectorBridge(runtime as unknown as ReplayDirectorRuntime);

      expect(handlers.size).toBe(3);
      const handler = handlers.get(`replayDirector:${method}`);
      expect(handler).toBeDefined();
      expect(handler?.()).toBe(promise);
      await promise;
      for (const name of [
        'backToProgram',
        'resumeAtCut',
        'stayHere',
      ] as const) {
        expect(runtime[name]).toHaveBeenCalledTimes(name === method ? 1 : 0);
      }
    }
  );
});
