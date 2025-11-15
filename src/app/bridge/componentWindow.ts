import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ComponentWindowOptions {
  componentName: string;
  config?: Record<string, unknown>;
  width?: number;
  height?: number;
}

/**
 * Creates a new Electron window to display a specific component
 * This allows you to open individual components in separate windows
 * with full access to telemetry and dashboard bridges
 * 
 * Example usage (from main process):
 *   openComponentWindow({ componentName: 'standings', width: 1024, height: 768 })
 */
export function openComponentWindow(options: ComponentWindowOptions): BrowserWindow {
  const {
    componentName,
    config = {},
    width = 1024,
    height = 768,
  } = options;

  const componentWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, '../../preload.ts'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Pass component info via data URL
  const componentUrl = `data:text/html;charset=utf-8,${encodeURIComponent(
    generateComponentWindowHtml(componentName, config)
  )}`;

  componentWindow.loadURL(componentUrl);
  componentWindow.show();

  return componentWindow;
}

/**
 * Generate HTML for a component window that runs within Electron context
 */
function generateComponentWindowHtml(
  componentName: string,
  config: Record<string, unknown>
): string {
  const configJson = JSON.stringify(config);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${componentName} - iRacing Component</title>
    <link rel="stylesheet" href="file:///${path.join(__dirname, '../../frontend/index.css')}">
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        background: #1a1a1a;
        color: #fff;
      }
      
      #app {
        width: 100%;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .loading {
        font-size: 18px;
        opacity: 0.7;
      }
    </style>
  </head>
  <body>
    <div id="app" class="loading">Loading ${componentName}...</div>
    <script type="module">
      import { createRoot } from 'https://esm.sh/react-dom@19';
      import {
        TelemetryProvider,
        DashboardProvider,
        RunningStateProvider,
        SessionProvider,
      } from 'https://esm.sh/@irdashies/context';
      import { WIDGET_MAP } from '../WidgetIndex.tsx';

      async function loadComponent() {
        const appContainer = document.getElementById('app');
        const componentName = '${componentName}'.toLowerCase();
        const config = ${configJson};
        
        try {
          // Get bridge objects from window (exposed by preload)
          const dashboardBridge = window.dashboardBridge;
          const irsdkBridge = window.irsdkBridge;

          if (!dashboardBridge || !irsdkBridge) {
            appContainer.innerHTML = \`
              <div style="padding: 20px; text-align: center; font-family: monospace;">
                <h2>⚠️ Missing bridge context</h2>
                <p>This component requires bridge objects from the Electron main process.</p>
              </div>
            \`;
            return;
          }

          // Get the component from the widget map
          const Component = WIDGET_MAP[componentName];

          if (!Component) {
            appContainer.innerHTML = \`
              <div style="padding: 20px; text-align: center; font-family: monospace;">
                <h2>❌ Component not found: <code>\${componentName}</code></h2>
                <p>Available components:</p>
                <ul style="text-align: left; display: inline-block;">
                  \${Object.keys(WIDGET_MAP)
                    .map((name) => \`<li><code>\${name}</code></li>\`)
                    .join('')}
                </ul>
              </div>
            \`;
            return;
          }

          // Create root and render component with providers
          const root = createRoot(appContainer);

          root.render(
            React.createElement(
              React.Fragment,
              null,
              React.createElement(DashboardProvider, { bridge: dashboardBridge },
                React.createElement(RunningStateProvider, { bridge: irsdkBridge },
                  React.createElement(SessionProvider, { bridge: irsdkBridge }),
                  React.createElement(TelemetryProvider, { bridge: irsdkBridge }),
                  React.createElement('div', null,
                    React.createElement(Component, config)
                  )
                )
              )
            )
          );

          console.log(\`✅ Loaded component: \${componentName}\`);
        } catch (error) {
          console.error(\`❌ Failed to load component: \${componentName}\`, error);
          appContainer.innerHTML = \`
            <div style="padding: 20px; color: #ff6b6b; font-family: monospace;">
              <h2>❌ Error loading component</h2>
              <p><code>\${componentName}</code></p>
              <pre style="background: #1a1a1a; padding: 10px; border-radius: 4px; overflow: auto; max-width: 600px; margin: 10px auto;">
\${error instanceof Error ? error.message : String(error)}
              </pre>
            </div>
          \`;
        }
      }

      loadComponent();
    </script>
  </body>
</html>`;
}
