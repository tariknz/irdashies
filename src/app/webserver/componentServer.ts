import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { IrSdkBridge, DashboardBridge } from '@irdashies/types';
import logger from '../logger';
import { currentDashboard } from './bridgeProxy';
import { getGarageCoverImageAsDataUrl } from '../storage/dashboards';
import type { WidgetId } from '../../frontend/WidgetIndex';

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
 * Access components via: http://[dynamic-ip]:<port>/component/<componentName>
 */
export async function startComponentServer(
  irsdkBridge?: IrSdkBridge,
  dashboardBridge?: DashboardBridge
) {
  const { getDashboard, getCurrentProfileId } =
    await import('../storage/dashboards');
  const profileId = getCurrentProfileId();
  const dashboard = getDashboard(profileId);
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

    const componentMatch = pathname.match(/^\/component\/([a-zA-Z0-9_-]+)$/);
    if (componentMatch && req.method === 'GET') {
      const componentName = componentMatch[1];

      if (!/^[a-zA-Z0-9_-]+$/.test(componentName)) {
        sendJSON(res, 400, { error: 'Invalid component name' });
        return;
      }

      // Individual component rendering is no longer supported
      // Use /dashboard route to view the full dashboard instead
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Component Rendering Deprecated</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; overflow: hidden; }
          body { background: #1e293b; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; }
          .message { text-align: center; padding: 2rem; }
          h1 { font-size: 1.5rem; margin-bottom: 1rem; }
          p { margin-bottom: 0.5rem; }
          code { background: #0f172a; padding: 0.25rem 0.5rem; border-radius: 0.25rem; }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>Individual Component Rendering Deprecated</h1>
          <p>Please use the full dashboard view instead:</p>
          <p><code>http://${SERVER_IP}:${actualPort}/dashboard</code></p>
        </div>
      </body>
      </html>
    `;

      sendHTML(res, html);
      return;
    }

    // Dashboard view - shows all overlays in one page
    if (pathname === '/dashboard' && req.method === 'GET') {
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

      let dashboardViewUrl: string;

      const cacheBust = Date.now();
      if (isDev) {
        const vitePort = process.env.VITE_PORT || '5173';
        dashboardViewUrl = `http://${SERVER_IP}:${vitePort}/index-dashboard-view.html?wsUrl=${encodeURIComponent(wsUrl)}&profile=${encodeURIComponent(profileId)}&debug=${debug}&v=${cacheBust}`;
      } else {
        dashboardViewUrl = `http://${SERVER_IP}:${actualPort}/index-dashboard-view.html?wsUrl=${encodeURIComponent(wsUrl)}&profile=${encodeURIComponent(profileId)}&debug=${debug}&v=${cacheBust}`;
      }

      // Serve HTML with iframe to dashboard view
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>irDashies - Dashboard</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #root { width: 100%; height: 100%; overflow: hidden; }
          body { background: transparent; font-family: system-ui, -apple-system, sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
          iframe { border: none; width: 100%; height: 100%; display: block; overflow: hidden; background: transparent; }
        </style>
      </head>
      <body>
        <iframe src="${dashboardViewUrl}" scrolling="no"></iframe>
      </body>
      </html>
    `;

      sendHTML(res, html);
      return;
    }

    if (pathname === '/api/profiles' && req.method === 'GET') {
      const { listProfiles } = await import('../storage/dashboards');
      const profiles = listProfiles();
      sendJSON(res, 200, { profiles });
      return;
    }

    if (pathname === '/components' && req.method === 'GET') {
      const componentNames: WidgetId[] = [
        'standings',
        'input',
        'tachometer',
        'relative',
        'map',
        'weather',
        'fastercarsfrombehind',
        'fuel',
        'blindspotmonitor',
        'garagecover',
        'rejoin',
        'laptimelog',
      ];

      sendJSON(res, 200, {
        components: componentNames,
        baseUrl: `http://${SERVER_IP}:${actualPort}`,
        websocketUrl: `ws://${SERVER_IP}:${actualPort}`,
        examples: componentNames.map(
          (name) => `http://${SERVER_IP}:${actualPort}/component/${name}`
        ),
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

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>irDashies</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .container { text-align: center; padding: 2rem; }
          h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #f8fafc; }
          .profiles { display: flex; flex-direction: column; gap: 0.75rem; }
          a { display: block; padding: 0.75rem 1.5rem; background: #1e293b; color: #38bdf8; text-decoration: none; border-radius: 0.5rem; border: 1px solid #334155; transition: background 0.15s, border-color 0.15s; }
          a:hover { background: #334155; border-color: #38bdf8; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>irDashies - Profiles</h1>
          <div class="profiles">${profileLinks}</div>
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
        dashboardBridge
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
