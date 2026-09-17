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

const bridgeProxyState: { currentDashboard: unknown } = {
  currentDashboard: null,
};
vi.mock('./bridgeProxy', () => ({
  get currentDashboard() {
    return bridgeProxyState.currentDashboard;
  },
  createBridgeProxy: vi.fn(),
}));

const getDashboard = vi.fn();
vi.mock('../storage/dashboards', () => ({
  getDashboard: (...args: unknown[]) => getDashboard(...args),
  getCurrentProfileId: () => 'test-profile',
  listProfiles: () => [{ id: 'default', name: 'Default' }],
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

interface FakeResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** Drives the request handler startComponentServer handed to http.createServer. */
async function request(path: string): Promise<FakeResponse> {
  const handler = createServer.mock.calls[0][0] as (
    req: unknown,
    res: unknown
  ) => Promise<void>;

  const res: FakeResponse = { statusCode: 200, headers: {}, body: '' };
  const fakeRes = {
    get statusCode() {
      return res.statusCode;
    },
    set statusCode(code: number) {
      res.statusCode = code;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = String(value);
    },
    end(chunk?: string | Buffer) {
      if (chunk) res.body = chunk.toString();
    },
  };

  await handler(
    { url: path, method: 'GET', headers: { host: 'localhost:3000' } },
    fakeRes
  );
  return res;
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

describe('single-widget routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    bridgeProxyState.currentDashboard = {
      widgets: [
        { id: 'carsystems', enabled: true },
        { id: 'standings', enabled: true },
        { id: 'weather', enabled: false },
      ],
    };
    await startWith({ enableWebServer: true });
  });

  it('serves /widget/<id> rather than falling through to the static handler', async () => {
    const res = await request('/widget/carsystems');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/html');
    expect(res.body).toContain('<iframe');
  });

  it('passes the widget id to the renderer bundle', async () => {
    const res = await request('/widget/carsystems');

    expect(res.body).toContain('widget=carsystems');
    expect(res.body).toContain('index-dashboard-view.html');
  });

  it('leaves /dashboard drawing every widget, with no widget parameter', async () => {
    const res = await request('/dashboard');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('index-dashboard-view.html');
    expect(res.body).not.toContain('widget=');
  });

  it('redirects the retired /component/<id> route to its replacement', async () => {
    const res = await request('/component/carsystems');

    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBe('/widget/carsystems');
  });

  it('carries the query string through that redirect', async () => {
    const res = await request('/component/carsystems?profile=race');

    expect(res.headers['location']).toBe('/widget/carsystems?profile=race');
  });

  it('lists enabled widgets from the live dashboard, not a hardcoded table', async () => {
    const res = await request('/components');
    const payload = JSON.parse(res.body);

    expect(payload.components).toEqual(['carsystems', 'standings']);
    expect(payload.examples).toContain(
      'http://localhost:3000/widget/carsystems'
    );
  });

  it('offers a widget link per enabled widget on the landing page', async () => {
    const res = await request('/');

    expect(res.body).toContain('href="/widget/carsystems"');
    expect(res.body).toContain('href="/widget/standings"');
    expect(res.body).not.toContain('href="/widget/weather"');
  });
});
