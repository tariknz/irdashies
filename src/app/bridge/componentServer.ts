import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import type { IrSdkBridge, DashboardBridge } from '@irdashies/types';
import { currentDashboard } from './bridgeProxy';

const PORT = 3000;
const COMPONENT_PORT = process.env.COMPONENT_PORT || PORT;

// Detect if we're in development or production
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;

// In production, the renderer files are in the .webpack/renderer directory
declare const MAIN_WINDOW_VITE_NAME: string;
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;

/**
 * Creates an Express server that serves components to external browsers
 * Bridge data is exposed via WebSocket so browsers can access real-time telemetry
 * 
 * Access components via: http://localhost:3000/component/<componentName>
 * Example: http://localhost:3000/component/standings
 */
export async function startComponentServer(irsdkBridge?: IrSdkBridge, dashboardBridge?: DashboardBridge) {
  const app = express();
  const httpServer = http.createServer(app);

  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // In production, serve static files from the renderer directory
  if (!isDev) {
    const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
    console.log(`   Serving static files from: ${rendererPath}`);
    app.use(express.static(rendererPath));
  }

  // Create bridge proxy if bridge is provided
  if (irsdkBridge) {
    try {
      // Dynamically import bridge proxy to avoid module resolution issues
      const { createBridgeProxy } = await import('./bridgeProxy');
      createBridgeProxy(httpServer, irsdkBridge, dashboardBridge);
      console.log(`   WebSocket bridge available at ws://localhost:${COMPONENT_PORT}`);
    } catch (err) {
      console.warn('Failed to initialize WebSocket bridge:', err);
    }
  }

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', message: 'Component server is running' });
  });

  /**
   * Debug endpoint to check current dashboard state
   */
  app.get('/debug/dashboard', (req: Request, res: Response) => {
    res.json({
      hasDashboard: !!currentDashboard,
      dashboard: currentDashboard,
      widgetCount: currentDashboard?.widgets?.length || 0,
      widgets: currentDashboard?.widgets?.map(w => ({
        id: w.id,
        hasConfig: !!w.config,
        configKeys: w.config ? Object.keys(w.config) : []
      }))
    });
  });

  /**
   * Serve a specific component as a standalone page
   * Uses an iframe to load component from Vite dev server
   * Passes widget config from dashboard if available
   */
  app.get('/component/:componentName', (req: Request, res: Response) => {
    const { componentName } = req.params;

    // Basic validation
    if (!/^[a-zA-Z0-9_-]+$/.test(componentName)) {
      return res.status(400).json({ error: 'Invalid component name' });
    }

    const wsUrl = 'http://localhost:3000';

    // Get widget config from dashboard (no stream config)
    let configParam = '';
    const normalizedName = componentName.toLowerCase();
    let finalConfig = {};
    
    console.log(`🔍 Component request for: ${componentName}`);
    console.log(`🔍 Normalized name: ${normalizedName}`);
    console.log(`🔍 Current dashboard exists: ${!!currentDashboard}`);
    
    if (currentDashboard) {
      console.log(`🔍 Dashboard widgets count: ${currentDashboard.widgets?.length || 0}`);
      console.log(`🔍 Dashboard widgets:`, currentDashboard.widgets?.map(w => w.id));
      
      const widget = currentDashboard.widgets?.find((w) => w.id.toLowerCase() === normalizedName);
      console.log(`🔍 Found widget: ${!!widget}`);
      
      if (widget?.config) {
        console.log(`✅ Found widget config for ${componentName}:`, JSON.stringify(widget.config, null, 2));
        finalConfig = widget.config;
      } else {
        console.log(`⚠️ No widget config found for ${componentName}`);
        if (widget) {
          console.log(`⚠️ Widget exists but config is:`, widget.config);
        }
      }
    } else {
      console.log(`⚠️ No dashboard available`);
    }
    
    if (Object.keys(finalConfig).length > 0) {
      configParam = `&config=${encodeURIComponent(JSON.stringify(finalConfig))}`;
      console.log(`📋 Final browser config for ${componentName}:`, JSON.stringify(finalConfig, null, 2));
    }

    // Determine the URL for the component renderer based on dev/prod mode
    let componentRendererUrl: string;
    
    if (isDev) {
      // In development, use Vite dev server
      const vitePort = process.env.VITE_PORT || '5173';
      componentRendererUrl = `http://localhost:${vitePort}/index-component-renderer.html?component=${encodeURIComponent(componentName)}&wsUrl=${encodeURIComponent(wsUrl)}${configParam}`;
    } else {
      // In production, use the local component server serving static files
      componentRendererUrl = `http://localhost:${COMPONENT_PORT}/index-component-renderer.html?component=${encodeURIComponent(componentName)}&wsUrl=${encodeURIComponent(wsUrl)}${configParam}`;
    }

    // Generate wrapper HTML that uses an iframe
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${componentName} Component</title>
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

    res.set('Content-Type', 'text/html');
    res.send(html);
  });

  /**
   * List available components
   */
  app.get('/components', (req: Request, res: Response) => {
    const componentNames = [
      'standings',
      'input',
      'relative',
      'map',
      'weather',
      'fastercarsfrombehind',
    ];

    res.json({
      components: componentNames,
      baseUrl: `http://localhost:${COMPONENT_PORT}`,
      websocketUrl: `ws://localhost:${COMPONENT_PORT}`,
      examples: componentNames.map(
        (name) => `http://localhost:${COMPONENT_PORT}/component/${name}`
      ),
    });
  });

  httpServer.listen(COMPONENT_PORT, () => {
    console.log(`✅ Component server running on http://localhost:${COMPONENT_PORT}`);
    console.log(`   Mode: ${isDev ? 'Development' : 'Production'}`);
    console.log(`   List components: http://localhost:${COMPONENT_PORT}/components`);
    console.log(
      `   View component: http://localhost:${COMPONENT_PORT}/component/<ComponentName>`
    );
  });
}

/**
 * Component renderer entry point configuration for Vite
 * This HTML file is created and served by Vite dev server
 * when accessing http://localhost:5173/component-renderer.html
 * 
 * In Vite, create: index-component-renderer.html with:
 * 
 * <!DOCTYPE html>
 * <html>
 * <head>
 *   <meta charset="UTF-8" />
 *   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
 *   <title>Component Renderer</title>
 *   <style>
 *     * { margin: 0; padding: 0; box-sizing: border-box; }
 *     html, body, #root { width: 100%; height: 100%; }
 *     body { background: #1a1a1a; }
 *   </style>
 * </head>
 * <body>
 *   <div id="root"></div>
 *   <script type="module">
 *     import { renderComponent } from '@app/bridge/componentRenderer';
 *     
 *     const params = new URLSearchParams(window.location.search);
 *     const component = params.get('component') || 'standings';
 *     const wsUrl = params.get('wsUrl') || 'http://localhost:3000';
 *     
 *     renderComponent(
 *       document.getElementById('root'),
 *       component,
 *       {},
 *       wsUrl
 *     ).catch(err => {
 *       console.error('Failed to render component:', err);
 *       document.getElementById('root').innerHTML = \`
 *         <div style="padding: 40px; color: #ff6b6b; font-family: monospace;">
 *           <h1>Error</h1>
 *           <p>\${err.message}</p>
 *         </div>
 *       \`;
 *     });
 *   </script>
 * </body>
 * </html>
 */
