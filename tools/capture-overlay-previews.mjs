import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const config = JSON.parse(
  fs.readFileSync(
    path.join(process.env.APPDATA ?? '', 'irdashies', 'config.json'),
    'utf8'
  )
);
const profileId = config.currentProfile ?? 'default';
const widgets = config.dashboards[profileId].widgets;
const simhubDir = optionValue('--simhub', 'C:\\Program Files (x86)\\SimHub');
const port = optionValue('--port', '3000');
const only = optionValue('--only', '');

const overlayName = (id) =>
  (id.charAt(0).toUpperCase() + id.slice(1)).replace(/[<>:"/\\|?*]/g, '_');

function edgePath() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('No Edge or Chrome found');
  return found;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('cdp connect failed')));
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const done = pending.get(message.id);
    if (done) {
      pending.delete(message.id);
      done(message);
    }
  });
  return {
    opened,
    call(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}

async function targets(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  return response.json();
}

async function enableDemoMode() {
  const pages = await targets(9223);
  const settings = pages.find((page) => page.url.includes('#/settings'));
  if (!settings) throw new Error('Settings page not found');
  const client = connect(settings.webSocketDebuggerUrl);
  await client.opened;
  const expression = `(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => /Demo/.test(item.textContent));
    if (!button) return 'missing';
    if (button.textContent.includes('Exit Demo')) return 'on';
    button.click();
    return 'clicked';
  })()`;
  const clicked = await client.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  const state = clicked.result?.result?.value;
  if (state === 'missing') throw new Error('Demo Mode button not found');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const check = await client.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    if (check.result?.result?.value === 'on') break;
  }
  client.close();
  process.stdout.write(`demo mode: ${state}\n`);
}

async function launchBrowser() {
  const userData = path.join(process.env.TEMP ?? '.', 'irdashies-preview-edge');
  fs.rmSync(userData, { recursive: true, force: true });
  const child = spawn(
    edgePath(),
    [
      '--headless=new',
      '--remote-debugging-port=9224',
      `--user-data-dir=${userData}`,
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const pages = await targets(9224);
      const page = pages.find((item) => item.type === 'page');
      if (page) return { child, page };
    } catch {
      // browser still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Capture browser did not start');
}

async function waitForLoad(client) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await client.call('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (ready.result?.result?.value === 'complete') break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function captureWidget(client, widget) {
  const width = Math.max(1, Math.round(widget.layout.width));
  const height = Math.max(1, Math.round(widget.layout.height));
  await client.call('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const url = `http://localhost:${port}/dashboard?profile=${encodeURIComponent(profileId)}&widget=${encodeURIComponent(widget.id)}`;
  await client.call('Page.navigate', { url });
  await waitForLoad(client);
  const frame = await client.call('Runtime.evaluate', {
    expression: "document.querySelector('iframe')?.src",
    returnByValue: true,
  });
  await client.call('Page.navigate', { url: frame.result.result.value });
  await waitForLoad(client);
  // The widget paints in an iframe after the websocket sends demo telemetry.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await client.call('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });
  const shot = await client.call('Page.captureScreenshot', {
    format: 'png',
    omitBackground: true,
  });
  const name = overlayName(widget.id);
  const file = path.join(
    simhubDir,
    'DashTemplates',
    name,
    `${name}.djson.png`
  );
  fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  process.stdout.write(`${name} ${width}x${height}\n`);
}

await enableDemoMode();
const browser = await launchBrowser();
const client = connect(browser.page.webSocketDebuggerUrl);
await client.opened;
await client.call('Page.enable');
const selected = only
  ? widgets.filter((widget) => widget.id === only)
  : widgets;
for (const widget of selected) {
  await captureWidget(client, widget);
}
client.close();
browser.child.kill();
