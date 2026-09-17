import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { IrSdkSourceBridge, DashboardBridge } from '@irdashies/types';
import logger from '../logger';
import { currentDashboard } from './bridgeProxy';
import { getGarageCoverImageAsDataUrl } from '../storage/dashboards';

const DEFAULT_PORT = 3000;
const FALLBACK_PORTS = [3001, 3002, 3003, 3004, 3005];

let actualPort: number = DEFAULT_PORT;

const isDev =
  process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;

declare const MAIN_WINDOW_VITE_NAME: string;

// Get the local IP address dynamically
function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;

    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        candidates.push(net.address);
      }
    }
  }

  if (candidates.length > 0) {
    // Prefer 192.168.x.x or 10.x.x.x addresses (common home/office networks)
    const preferred = candidates.find(
      (ip) =>
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.')
    );
    return preferred || candidates[0];
  }

  return 'localhost';
}

let SERVER_IP = 'localhost';

export function getComponentServerPort(): number {
  return actualPort;
}

function tryListen(
  server: http.Server,
  port: number,
  host: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function listenOnAvailablePort(
  server: http.Server,
  host: string
): Promise<number> {
  const envPort = process.env.COMPONENT_PORT;
  if (envPort) {
    // If explicitly set, only try that port
    return tryListen(server, Number(envPort), host);
  }

  const portsToTry = [DEFAULT_PORT, ...FALLBACK_PORTS];
  for (const port of portsToTry) {
    try {
      return await tryListen(server, port, host);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} is in use, trying next...`);
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `All ports exhausted (${[DEFAULT_PORT, ...FALLBACK_PORTS].join(', ')}). Cannot start component server.`
  );
}

function setCORSHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
}

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendHTML(res: http.ServerResponse, html: string) {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.statusCode = 200;
  res.end(html);
}

/**
 * Every widget the active dashboard knows about, and whether it is enabled for
 * the desktop overlays.
 *
 * Disabled widgets are listed too, because /widget/<id> deliberately renders
 * them: a widget kept off the screen can still be worth its own VR overlay
 * tab, and leaving it off this page would hide a URL that works.
 *
 * Derived from the live dashboard rather than a hardcoded list. The list this
 * replaced had drifted badly (it named ten widgets when the app shipped
 * twenty-seven), and the main process cannot enumerate WIDGET_MAP itself
 * without importing renderer code across the layer boundary (R1.1).
 */
function listDashboardWidgets(): { id: string; enabled: boolean }[] {
  const seen = new Map<string, boolean>();
  for (const widget of currentDashboard?.widgets ?? []) {
    if (!seen.has(widget.id)) seen.set(widget.id, !!widget.enabled);
  }
  // Enabled first: those are the ones someone is most likely looking for.
  return [...seen]
    .map(([id, enabled]) => ({ id, enabled }))
    .sort((a, b) => Number(b.enabled) - Number(a.enabled));
}

/**
 * URL of the renderer bundle that draws the overlays, with `params` appended.
 *
 * In dev the bundle is served by Vite on its own port; in a packaged build it
 * comes off this server as a static file. The cache buster is what stops a
 * browser source from pinning itself to a stale bundle across a reinstall.
 */
function buildDashboardViewUrl(params: Record<string, string>): string {
  const host = isDev
    ? `${SERVER_IP}:${process.env.VITE_PORT || '5173'}`
    : `${SERVER_IP}:${actualPort}`;
  const search = new URLSearchParams({ ...params, v: String(Date.now()) });
  return `http://${host}/index-dashboard-view.html?${search.toString()}`;
}

/**
 * Chrome-free page whose only content is a full-viewport iframe.
 *
 * Both the dashboard view and the single-widget view are consumed as browser
 * sources — OBS, and OpenKneeboard in VR — so the shell paints no background
 * of its own and leaves the overlay to composite over whatever is behind it.
 */
function renderIframeShell(title: string, viewUrl: string): string {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #root { width: 100%; height: 100%; overflow: hidden; }
          body { background: transparent; font-family: system-ui, -apple-system, sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
          iframe { border: none; width: 100%; height: 100%; display: block; overflow: hidden; background: transparent; }
        </style>
      </head>
      <body>
        <iframe src="${escapeHtml(viewUrl)}" scrolling="no"></iframe>
      </body>
      </html>
    `;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function serveStaticFile(filePath: string, res: http.ServerResponse) {
  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const content = await fs.promises.readFile(filePath);
    const mimeType = getMimeType(filePath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', content.length);
    // HTML files must not be cached — JS/CSS have content-hashed filenames and can be cached
    if (mimeType === 'text/html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    res.statusCode = 200;
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end('Not Found');
  }
}

/**
 * Creates an HTTP server that serves components to external browsers
 * Bridge data is exposed via WebSocket so browsers can access real-time telemetry
 *
 * Routes:
 *   /                  profile and widget index
 *   /dashboard         every enabled overlay on one page
 *   /widget/<widgetId> a single overlay filling the window
 */
export async function startComponentServer(
  irsdkBridge?: IrSdkSourceBridge,
  dashboardBridge?: DashboardBridge,
  channelBus?: import('../bridge/channelBridge').ChannelBus
) {
  const { getDashboard, getCurrentProfileId } =
    await import('../storage/dashboards');
  const profileId = getCurrentProfileId();
  const dashboard = getDashboard(profileId);
  // Default to true so existing installs (which have no such key stored) keep
  // serving browser sources exactly as before.
  const webServerEnabled = dashboard?.generalSettings?.enableWebServer ?? true;
  if (!webServerEnabled) {
    logger.info(
      'Component server disabled via generalSettings.enableWebServer - not listening on any port.'
    );
    return;
  }

  const networkAccess =
    dashboard?.generalSettings?.enableNetworkAccess ?? false;
  const bindHost = networkAccess ? '0.0.0.0' : 'localhost';
  SERVER_IP = networkAccess ? getLocalIPAddress() : 'localhost';

  let staticPath: string | null = null;
  if (!isDev) {
    staticPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
  }

  const httpServer = http.createServer(async (req, res) => {
    setCORSHeaders(res);

    if (!req.url) {
      res.statusCode = 400;
      res.end('Bad Request');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (
      !isDev &&
      staticPath &&
      pathname !== '/' &&
      !pathname.startsWith('/health') &&
      !pathname.startsWith('/debug') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/component') &&
      !pathname.startsWith('/components') &&
      !pathname.startsWith('/widget') &&
      !pathname.startsWith('/dashboard')
    ) {
      const filePath = path.join(staticPath, pathname);
      await serveStaticFile(filePath, res);
      return;
    }

    if (pathname === '/health' && req.method === 'GET') {
      sendJSON(res, 200, {
        status: 'ok',
        message: 'Component server is running',
      });
      return;
    }

    if (pathname === '/api/server-ip' && req.method === 'GET') {
      sendJSON(res, 200, { ip: SERVER_IP });
      return;
    }

    if (pathname === '/debug/dashboard' && req.method === 'GET') {
      sendJSON(res, 200, {
        hasDashboard: !!currentDashboard,
        dashboard: currentDashboard,
        widgetCount: currentDashboard?.widgets?.length || 0,
        widgets: currentDashboard?.widgets?.map((w) => ({
          id: w.id,
          hasConfig: !!w.config,
          configKeys: w.config ? Object.keys(w.config) : [],
        })),
      });
      return;
    }

    if (pathname === '/api/garage-cover-image' && req.method === 'GET') {
      const filename = url.searchParams.get('filename');
      if (!filename) {
        sendJSON(res, 400, { error: 'Missing filename' });
        return;
      }

      try {
        const dataUrl = await getGarageCoverImageAsDataUrl(filename);
        if (!dataUrl) {
          sendJSON(res, 404, { error: 'Image not found' });
          return;
        }
        sendJSON(res, 200, { dataUrl });
      } catch (err) {
        logger.error(
          '[ComponentServer] Error loading garage cover image:',
          err
        );
        sendJSON(res, 500, { error: 'Failed to load image' });
      }
      return;
    }

    // /component/<id> was the original single-widget route, later stubbed out
    // with a deprecation page pointing at /dashboard. Single widgets are a real
    // route again under /widget/<id>, so redirect instead of breaking links
    // people already saved in OBS.
    const componentMatch = pathname.match(/^\/component\/([a-zA-Z0-9_-]+)$/);
    if (componentMatch && req.method === 'GET') {
      res.statusCode = 302;
      res.setHeader('Location', `/widget/${componentMatch[1]}${url.search}`);
      res.end();
      return;
    }

    // Two views onto the same renderer bundle: /dashboard draws every enabled
    // overlay on one page, /widget/<id> draws exactly one filling the window.
    // The single-widget form is what VR overlay hosts such as OpenKneeboard
    // want, since each of their tabs shows one page and is sized by hand.
    const widgetMatch = pathname.match(/^\/widget\/([a-zA-Z0-9_-]+)$/);
    if ((pathname === '/dashboard' || widgetMatch) && req.method === 'GET') {
      const wsUrl = `http://${SERVER_IP}:${actualPort}`;
      const debug = url.searchParams.get('debug') || 'false';

      // Get profile ID from URL param (check both 'profile' and 'profileId')
      const profileIdParam =
        url.searchParams.get('profile') || url.searchParams.get('profileId');
      let profileId = profileIdParam;

      if (!profileId) {
        const { getCurrentProfileId } = await import('../storage/dashboards');
        profileId = getCurrentProfileId();
      }

      const params: Record<string, string> = {
        wsUrl,
        profile: profileId,
        debug,
      };
      if (widgetMatch) {
        params.widget = widgetMatch[1];
      }

      const title = widgetMatch
        ? `irDashies - ${widgetMatch[1]}`
        : 'irDashies - Dashboard';

      sendHTML(res, renderIframeShell(title, buildDashboardViewUrl(params)));
      return;
    }

    if (pathname === '/api/profiles' && req.method === 'GET') {
      const { listProfiles } = await import('../storage/dashboards');
      const profiles = listProfiles();
      sendJSON(res, 200, { profiles });
      return;
    }

    if (pathname === '/components' && req.method === 'GET') {
      const baseUrl = `http://${SERVER_IP}:${actualPort}`;
      const widgets = listDashboardWidgets();
      const componentNames = widgets.map((w) => w.id);

      sendJSON(res, 200, {
        components: componentNames,
        enabled: widgets.filter((w) => w.enabled).map((w) => w.id),
        baseUrl,
        websocketUrl: `ws://${SERVER_IP}:${actualPort}`,
        dashboardUrl: `${baseUrl}/dashboard`,
        examples: componentNames.map((name) => `${baseUrl}/widget/${name}`),
      });
      return;
    }

    if (pathname === '/' && req.method === 'GET') {
      const { listProfiles } = await import('../storage/dashboards');
      const profiles = listProfiles();

      const profileLinks = profiles
        .map(
          (p) =>
            `<a href="/dashboard?profile=${encodeURIComponent(p.id)}">${escapeHtml(p.name || p.id)}</a>`
        )
        .join('');

      // One row per enabled widget. This is the page people copy URLs out of
      // when setting up a VR overlay host, so each row shows the URL itself
      // rather than only linking it.
      const widgets = listDashboardWidgets();
      const widgetLinks = widgets
        .map(({ id, enabled }) => {
          const href = `/widget/${encodeURIComponent(id)}`;
          const full = `http://${SERVER_IP}:${actualPort}${href}`;
          const badge = enabled ? '' : '<em>off on desktop</em>';
          return `<a href="${href}"><span>${escapeHtml(id)}${badge}</span><code>${escapeHtml(full)}</code></a>`;
        })
        .join('');

      const widgetSection = widgets.length
        ? `<h2>Single widgets</h2><div class="widgets">${widgetLinks}</div>`
        : `<h2>Single widgets</h2><p class="empty">This profile has no widgets.</p>`;

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>irDashies</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; min-height: 100vh; }
          .container { padding: 2rem; width: 100%; max-width: 44rem; }
          h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #f8fafc; }
          h2 { font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin: 1.75rem 0 0.75rem; }
          .profiles, .widgets { display: flex; flex-direction: column; gap: 0.5rem; }
          a { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 0.75rem 1.5rem; background: #1e293b; color: #38bdf8; text-decoration: none; border-radius: 0.5rem; border: 1px solid #334155; transition: background 0.15s, border-color 0.15s; }
          a:hover { background: #334155; border-color: #38bdf8; }
          code { color: #64748b; font-size: 0.8rem; white-space: nowrap; }
          .empty { color: #64748b; font-size: 0.9rem; }
          em { font-style: normal; color: #64748b; font-size: 0.75rem; margin-left: 0.6rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>irDashies</h1>
          <h2>Full dashboard</h2>
          <div class="profiles">${profileLinks}</div>
          ${widgetSection}
        </div>
      </body>
      </html>
      `;

      sendHTML(res, html);
      return;
    }

    res.statusCode = 404;
    res.end('Not Found');
  });

  if (irsdkBridge) {
    try {
      const { createBridgeProxy } = await import('./bridgeProxy');
      const { resubscribeToBridge } = createBridgeProxy(
        httpServer,
        irsdkBridge,
        dashboardBridge,
        channelBus
      );

      const { onBridgeChanged } = await import('../bridge/iracingSdk/setup');
      onBridgeChanged((newBridge) => {
        resubscribeToBridge(newBridge);
      });
    } catch (err) {
      logger.warn('Failed to initialize WebSocket bridge:', err);
    }
  }
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    logger.error('Server error:', error);
    if (error.code === 'EACCES') {
      logger.error(`   Permission denied to bind to port ${actualPort}`);
      logger.error(
        `   Try running as administrator or use a port number above 1024`
      );
    }
  });

  try {
    actualPort = await listenOnAvailablePort(httpServer, bindHost);
    logger.info(
      `Component server running on http://${SERVER_IP}:${actualPort}`
    );
  } catch (err) {
    logger.error('Failed to start component server:', err);
  }
}
