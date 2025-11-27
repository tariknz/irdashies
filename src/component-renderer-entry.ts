/**
 * Component Renderer Entry Point
 * This file is ONLY loaded when rendering components in a browser
 * It does NOT import the main App.tsx (which requires Electron context)
 */

// Only import what we need for the browser environment
import './frontend/index.css';
import './frontend/theme.css';
import { renderComponent } from './app/bridge/componentRenderer';

// Parse URL parameters to determine which component to render
const params = new URLSearchParams(window.location.search);
const componentName = params.get('component');
const wsUrl = params.get('wsUrl') || 'http://localhost:3000';
const configJson = params.get('config');
const isDebugMode = params.get('debug') === 'true';

// Make debug flag globally available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__DEBUG_MODE__ = isDebugMode;

if (isDebugMode) {
  console.log('📦 Component renderer entry point loaded (NOT loading App.tsx)');
}

let config = {};
try {
  config = configJson ? JSON.parse(decodeURIComponent(configJson)) : {};
} catch (e) {
  console.error('Failed to parse config JSON:', e);
}

if (isDebugMode) {
  console.log('📋 URL Parameters:');
  console.log(`  Component: ${componentName}`);
  console.log(`  WebSocket URL: ${wsUrl}`);
  console.log(`  Config:`, config);
}

// Check if WebSocket is available
if (typeof window !== 'undefined' && !window.WebSocket) {
  console.error('❌ WebSocket not available! This browser may not support WebSocket.');
}

// Find or create the root element
let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  rootElement.style.width = '100%';
  rootElement.style.height = '100%';
  document.body.appendChild(rootElement);
}

// Show loading indicator
rootElement.innerHTML = `
  <div id="loading-indicator" style="
    padding: 40px;
    background: transparent;
    color: #fff;
    font-family: monospace;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 20px;
  ">
    <h1 style="font-size: 32px; margin: 0;">🔄 Loading Component</h1>
    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
      <p style="margin: 0; color: #4ade80;">Component: <strong>${componentName || 'none'}</strong></p>
      <p style="margin: 0; color: #60a5fa;">WebSocket: <strong>${wsUrl}</strong></p>
      <p style="margin: 0; color: #fbbf24;">Config: <strong>${Object.keys(config).length} keys</strong></p>
    </div>
    <div style="margin-top: 20px; padding: 20px; background: #374151; border-radius: 8px; max-width: 600px;">
      <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.6;">
        ⏳ Initializing stores and connecting to WebSocket bridge...<br/>
        Check browser console (F12) for detailed logs.
      </p>
    </div>
    <div style="margin-top: 20px;">
      <div style="width: 50px; height: 50px; border: 4px solid #374151; border-top-color: #4ade80; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    </div>
  </div>
  <style>
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
`;

// Render the component
if (componentName) {
  if (isDebugMode) {
    console.log('🎯 Starting component render...');
  }
  renderComponent(rootElement, componentName, config, wsUrl)
    .then(() => {
      if (isDebugMode) {
        console.log('✅ Component render completed successfully');
      }
    })
    .catch((err) => {
      console.error('❌ Component render failed:', err);
      rootElement.innerHTML = `
        <div style="
          padding: 40px;
          background: transparent;
          color: #ff6b6b;
          font-family: monospace;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        ">
          <h1>❌ Failed to Load Component</h1>
          <p style="margin-top: 20px;">Component: ${componentName}</p>
          <p style="margin-top: 10px; color: #999;">${err.message}</p>
          <pre style="margin-top: 20px; color: #666; font-size: 12px; max-width: 600px; overflow: auto;">${err.stack || ''}</pre>
        </div>
      `;
    });
} else {
  rootElement.innerHTML = `
    <div style="
      padding: 40px;
      background: transparent;
      color: #fff;
      font-family: monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    ">
      <h1>Component Renderer</h1>
      <p>No component specified. Use ?component=standings to render a component</p>
      <p style="margin-top: 20px; color: #999; font-size: 14px;">
        Example: ?component=standings&wsUrl=http://localhost:3000
      </p>
    </div>
  `;
}
