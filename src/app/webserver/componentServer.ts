import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { IrSdkBridge, DashboardBridge } from '@irdashies/types';
import { currentDashboard } from './bridgeProxy';
import { getGarageCoverImageAsDataUrl } from '../storage/dashboards';
import crypto from 'crypto';
import type { WidgetId } from '../../frontend/WidgetIndex';

const PORT = 3000;
const COMPONENT_PORT = process.env.COMPONENT_PORT || PORT;

// Cache for widget configs to avoid passing large data in URL
const configCache = new Map<string, unknown>();

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

function sendHTML(res: http.ServerResponse, html: string) {
  res.setHeader('Content-Type', 'text/html');
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
    res.setHeader('Content-Type', getMimeType(filePath));
    res.setHeader('Content-Length', content.length);
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
 * Access components via: http://[dynamic-ip]:3000/component/<componentName>
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

    if (pathname === '/api/config' && req.method === 'GET') {
      const configId = url.searchParams.get('id');
      if (!configId) {
        sendJSON(res, 400, { error: 'Missing config ID' });
        return;
      }

      const config = configCache.get(configId);
      if (!config) {
        sendJSON(res, 404, { error: 'Config not found' });
        return;
      }

      sendJSON(res, 200, { config });
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
        console.error(
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

      const normalizedName = componentName.toLowerCase();
      let finalConfig = {};

      if (currentDashboard) {
        const widget = currentDashboard.widgets?.find(
          (w) => w.id.toLowerCase() === normalizedName
        );
        if (widget?.config) {
          finalConfig = widget.config;
        }
      }

      // Store config in cache and pass only the ID in URL to avoid 431 errors
      const configId = crypto.randomBytes(16).toString('hex');
      configCache.set(configId, finalConfig);

      // Clean up old cache entries (keep last 50)
      if (configCache.size > 50) {
        const keys = Array.from(configCache.keys());
        for (let i = 0; i < keys.length - 50; i++) {
          configCache.delete(keys[i]);
        }
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
          <p><code>http://${SERVER_IP}:3000/dashboard</code></p>
        </div>
      </body>
      </html>
    `;

      sendHTML(res, html);
      return;
    }

    // Dashboard view - shows all overlays in one page
    if (pathname === '/dashboard' && req.method === 'GET') {
      const wsUrl = `http://${SERVER_IP}:${COMPONENT_PORT}`;
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

      if (isDev) {
        const vitePort = process.env.VITE_PORT || '5173';
        dashboardViewUrl = `http://${SERVER_IP}:${vitePort}/index-dashboard-view.html?wsUrl=${encodeURIComponent(wsUrl)}&profile=${encodeURIComponent(profileId)}&debug=${debug}`;
      } else {
        dashboardViewUrl = `http://${SERVER_IP}:${COMPONENT_PORT}/index-dashboard-view.html?wsUrl=${encodeURIComponent(wsUrl)}&profile=${encodeURIComponent(profileId)}&debug=${debug}`;
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

    if (pathname === '/components' && req.method === 'GET') {
      const componentNames: WidgetId[] = [
        'standings',
        'input',
        'relative',
        'map',
        'weather',
        'fastercarsfrombehind',
        'fuel',
        'blindspotmonitor',
        'garagecover',
        'rejoin',
      ];

      sendJSON(res, 200, {
        components: componentNames,
        baseUrl: `http://${SERVER_IP}:${COMPONENT_PORT}`,
        websocketUrl: `ws://${SERVER_IP}:${COMPONENT_PORT}`,
        examples: componentNames.map(
          (name) => `http://${SERVER_IP}:${COMPONENT_PORT}/component/${name}`
        ),
      });
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
      console.warn('Failed to initialize WebSocket bridge:', err);
    }
  }
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(
        `   Port ${COMPONENT_PORT} is already in use by another application`
      );
      console.error(
        `   Try changing COMPONENT_PORT environment variable or close other apps using this port`
      );
    } else if (error.code === 'EACCES') {
      console.error(`   Permission denied to bind to port ${COMPONENT_PORT}`);
      console.error(
        `   Try running as administrator or use a port number above 1024`
      );
    }
  });

  httpServer.listen(Number(COMPONENT_PORT), bindHost, () => {
    console.log(
      `Component server running on http://${SERVER_IP}:${COMPONENT_PORT}`
    );
  });
}
