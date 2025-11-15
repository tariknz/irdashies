import express, { Request, Response } from 'express';
import http from 'http';
import type { IrSdkBridge } from '@irdashies/types';

const PORT = 3000;
const COMPONENT_PORT = process.env.COMPONENT_PORT || PORT;

/**
 * Creates an Express server that serves components to external browsers
 * Bridge data is exposed via WebSocket so browsers can access real-time telemetry
 * 
 * Access components via: http://localhost:3000/component/<componentName>
 * Example: http://localhost:3000/component/standings
 */
export async function startComponentServer(irsdkBridge?: IrSdkBridge) {
  const app = express();
  const httpServer = http.createServer(app);

  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Create bridge proxy if bridge is provided
  if (irsdkBridge) {
    try {
      // Dynamically import bridge proxy to avoid module resolution issues
      const { createBridgeProxy } = await import('./bridgeProxy');
      createBridgeProxy(httpServer, irsdkBridge);
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
   * Serve a specific component as a standalone page
   * Uses an iframe to load component from Vite dev server
   */
  app.get('/component/:componentName', (req: Request, res: Response) => {
    const { componentName } = req.params;

    // Basic validation
    if (!/^[a-zA-Z0-9_-]+$/.test(componentName)) {
      return res.status(400).json({ error: 'Invalid component name' });
    }

    const vitePort = process.env.VITE_PORT || '5173';
    const wsUrl = 'http://localhost:3000';

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
          html, body, #root { width: 100%; height: 100%; }
          body { background: #1a1a1a; font-family: system-ui, -apple-system, sans-serif; }
          iframe { border: none; width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <iframe src="http://localhost:${vitePort}/component-renderer.html?component=${encodeURIComponent(componentName)}&wsUrl=${encodeURIComponent(wsUrl)}"></iframe>
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
