/**
 * Component Renderer Entry Point
 * This file is ONLY loaded when rendering components in a browser
 * It does NOT import the main App.tsx (which requires Electron context)
 */

// Only import what we need for the browser environment
import './frontend/index.css';
import { renderComponent } from './app/bridge/componentRenderer';

console.log('📦 Component renderer entry point loaded (NOT loading App.tsx)');

// Parse URL parameters to determine which component to render
const params = new URLSearchParams(window.location.search);
const componentName = params.get('component');
const wsUrl = params.get('wsUrl') || 'http://localhost:3000';
const configJson = params.get('config');

const config = configJson ? JSON.parse(decodeURIComponent(configJson)) : {};

console.log('📋 URL Parameters:');
console.log(`  Component: ${componentName}`);
console.log(`  WebSocket URL: ${wsUrl}`);
console.log(`  Config:`, config);

// Find or create the root element
let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  rootElement.style.width = '100%';
  rootElement.style.height = '100%';
  document.body.appendChild(rootElement);
}

// Render the component
if (componentName) {
  renderComponent(rootElement, componentName, config, wsUrl);
} else {
  rootElement.innerHTML = `
    <div style="
      padding: 40px;
      background: #1a1a1a;
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
