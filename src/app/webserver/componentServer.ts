import http from 'http';
import fs from 'fs';
import path from 'path';
import type { IrSdkBridge, DashboardBridge } from '@irdashies/types';
import { currentDashboard } from './bridgeProxy';
import { getGarageCoverImageAsDataUrl } from '../storage/dashboards';
import crypto from 'crypto';
import type { WidgetId } from '../../frontend/WidgetIndex';

const PORT = 3000;
const COMPONENT_PORT = process.env.COMPONENT_PORT || PORT;

// Cache for widget configs to avoid passing large data in URL
const configCache = new Map<string, unknown>();

const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;

declare const MAIN_WINDOW_VITE_NAME: string;

function setCORSHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
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
 * Access components via: http://localhost:3000/component/<componentName>
 */
export async function startComponentServer(irsdkBridge?: IrSdkBridge, dashboardBridge?: DashboardBridge) {
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

    if (!isDev && staticPath && pathname !== '/' && !pathname.startsWith('/health') && 
        !pathname.startsWith('/debug') && !pathname.startsWith('/component') && 
        !pathname.startsWith('/components')) {
      const filePath = path.join(staticPath, pathname);
      await serveStaticFile(filePath, res);
      return;
    }

    if (pathname === '/health' && req.method === 'GET') {
      sendJSON(res, 200, { status: 'ok', message: 'Component server is running' });
      return;
    }

    if (pathname === '/debug/dashboard' && req.method === 'GET') {
      sendJSON(res, 200, {
        hasDashboard: !!currentDashboard,
        dashboard: currentDashboard,
        widgetCount: currentDashboard?.widgets?.length || 0,
        widgets: currentDashboard?.widgets?.map(w => ({
          id: w.id,
          hasConfig: !!w.config,
          configKeys: w.config ? Object.keys(w.config) : []
        }))
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
        console.error('[ComponentServer] Error loading garage cover image:', err);
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

      const wsUrl = 'http://localhost:3000';
      const normalizedName = componentName.toLowerCase();
      let finalConfig = {};
      
      if (currentDashboard) {
        const widget = currentDashboard.widgets?.find((w) => w.id.toLowerCase() === normalizedName);
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

      let componentRendererUrl: string;
      
      if (isDev) {
        const vitePort = process.env.VITE_PORT || '5173';
        componentRendererUrl = `http://localhost:${vitePort}/index-component-renderer.html?component=${encodeURIComponent(componentName)}&wsUrl=${encodeURIComponent(wsUrl)}&configId=${configId}`;
      } else {
        componentRendererUrl = `http://localhost:${COMPONENT_PORT}/index-component-renderer.html?component=${encodeURIComponent(componentName)}&wsUrl=${encodeURIComponent(wsUrl)}&configId=${configId}`;
      }

      const escapedName = componentName.replace(/[<>&"']/g, '');
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapedName} Component</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #root { width: 100%; height: 100%; overflow: hidden; }
          body { background: transparent; font-family: system-ui, -apple-system, sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
          iframe { border: none; width: 100%; height: 100%; display: block; overflow: hidden; background: transparent; }
        </style>
      </head>
      <body>
        <iframe src="${componentRendererUrl}" scrolling="no"></iframe>
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
        baseUrl: `http://localhost:${COMPONENT_PORT}`,
        websocketUrl: `ws://localhost:${COMPONENT_PORT}`,
        examples: componentNames.map(
          (name) => `http://localhost:${COMPONENT_PORT}/component/${name}`
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
      const { resubscribeToBridge } = createBridgeProxy(httpServer, irsdkBridge, dashboardBridge);
      
      const { onBridgeChanged } = await import('../bridge/iracingSdk/setup');
      onBridgeChanged((newBridge) => {
        resubscribeToBridge(newBridge);
      });
    } catch (err) {
      console.warn('Failed to initialize WebSocket bridge:', err);
    }
  }

  httpServer.listen(Number(COMPONENT_PORT), 'localhost', () => {
    console.log(`Component server running on http://localhost:${COMPONENT_PORT}`);
  });
}

