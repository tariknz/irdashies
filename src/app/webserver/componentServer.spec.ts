import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneralSettingsType } from '@irdashies/types';

const listen = vi.fn();
const createServer = vi.fn();

vi.mock('http', () => ({
  default: {
    createServer: (...args: unknown[]) => createServer(...args),
  },
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/irdashies-test' },
}));

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const getDashboard = vi.fn();
vi.mock('../storage/dashboards', () => ({
  getDashboard: (...args: unknown[]) => getDashboard(...args),
  getCurrentProfileId: () => 'test-profile',
  getGarageCoverImageAsDataUrl: vi.fn(),
}));

/** Minimal stand-in for http.Server that resolves tryListen()'s 'listening' event. */
function makeFakeServer() {
  const handlers = new Map<string, ((...a: unknown[]) => void)[]>();
  return {
    once(event: string, cb: (...a: unknown[]) => void) {
      handlers.set(event, [...(handlers.get(event) ?? []), cb]);
      return this;
    },
    on(event: string, cb: (...a: unknown[]) => void) {
      return this.once(event, cb);
    },
    removeListener() {
      return this;
    },
    listen(...args: unknown[]) {
      listen(...args);
      handlers.get('listening')?.forEach((cb) => cb());
    },
  };
}

async function startWith(generalSettings: GeneralSettingsType | undefined) {
  vi.resetModules();
  // Injected by the Vite/Forge build at compile time; absent under vitest.
  vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');
  listen.mockClear();
  createServer.mockClear();
  createServer.mockImplementation(() => makeFakeServer());
  getDashboard.mockReturnValue({ widgets: [], generalSettings });

  const { startComponentServer } = await import('./componentServer');
  await startComponentServer();
}

describe('startComponentServer web server flag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts when enableWebServer is absent (default on, existing installs)', async () => {
    await startWith({ enableNetworkAccess: false });
    expect(createServer).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(3000, 'localhost');
  });

  it('starts when enableWebServer is explicitly true', async () => {
    await startWith({ enableWebServer: true });
    expect(listen).toHaveBeenCalledWith(3000, 'localhost');
  });

  it('does not create or bind a server when enableWebServer is false', async () => {
    await startWith({ enableWebServer: false });
    expect(createServer).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  it('stays disabled even when network access is on', async () => {
    await startWith({ enableWebServer: false, enableNetworkAccess: true });
    expect(listen).not.toHaveBeenCalled();
  });
});
