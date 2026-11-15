import type { BrowserWindow, Debugger, WebContents } from 'electron';
import type { IbtInspectorRendererHeapSample } from '../../types';

interface Target {
  window: BrowserWindow;
  webContents: WebContents;
  debugSession: Debugger;
  heapProfilerEnabled: boolean;
  sample: Omit<IbtInspectorRendererHeapSample, 'usedHeapMB' | 'totalHeapMB'>;
}

const megabytes = (bytes: unknown): number | null =>
  typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0
    ? bytes / 1024 / 1024
    : null;

const routeName = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hash) return parsed.hash.slice(1);
    return parsed.pathname.split('/').filter(Boolean).at(-1) || 'renderer';
  } catch {
    return 'renderer';
  }
};

/** Samples live renderer V8 usage without forcing garbage collection. */
export class RendererHeapSampler {
  private targets: Target[] = [];
  private skippedTargets = 0;

  constructor(private readonly getWindows: () => BrowserWindow[]) {}

  start(): { attachedTargets: number; skippedTargets: number } {
    this.stop();
    this.skippedTargets = 0;
    for (const window of this.getWindows()) {
      if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
      const url = window.webContents.getURL();
      if (url.includes('#/ibt-inspector') || url.includes('#/tape-replay'))
        continue;
      const debugSession = window.webContents.debugger;
      if (debugSession.isAttached()) {
        this.skippedTargets++;
        continue;
      }
      try {
        debugSession.attach('1.3');
        const pid = window.webContents.getOSProcessId();
        this.targets.push({
          window,
          webContents: window.webContents,
          debugSession,
          heapProfilerEnabled: false,
          sample: {
            key: `${pid}:${window.webContents.id}`,
            pid,
            route: routeName(url),
          },
        });
      } catch {
        this.skippedTargets++;
      }
    }
    return {
      attachedTargets: this.targets.length,
      skippedTargets: this.skippedTargets,
    };
  }

  async sample(): Promise<IbtInspectorRendererHeapSample[]> {
    return Promise.all(
      this.targets.map(async (target) => {
        let usedHeapMB: number | null = null;
        let totalHeapMB: number | null = null;
        if (
          !target.window.isDestroyed() &&
          !target.webContents.isDestroyed() &&
          target.debugSession.isAttached()
        ) {
          try {
            const raw: unknown = await target.debugSession.sendCommand(
              'Runtime.getHeapUsage'
            );
            if (typeof raw === 'object' && raw !== null) {
              const usage = raw as Record<string, unknown>;
              usedHeapMB = megabytes(usage.usedSize);
              totalHeapMB = megabytes(usage.totalSize);
            }
          } catch {
            // The target may close or detach during a capture.
          }
        }
        return { ...target.sample, usedHeapMB, totalHeapMB };
      })
    );
  }

  async collectGarbageAndSample(): Promise<IbtInspectorRendererHeapSample[]> {
    return Promise.all(
      this.targets.map(async (target) => {
        let usedHeapMB: number | null = null;
        let totalHeapMB: number | null = null;
        if (
          !target.window.isDestroyed() &&
          !target.webContents.isDestroyed() &&
          target.debugSession.isAttached()
        ) {
          try {
            if (!target.heapProfilerEnabled) {
              await target.debugSession.sendCommand('HeapProfiler.enable');
              target.heapProfilerEnabled = true;
            }
            await target.debugSession.sendCommand(
              'HeapProfiler.collectGarbage'
            );
            const raw: unknown = await target.debugSession.sendCommand(
              'Runtime.getHeapUsage'
            );
            if (typeof raw === 'object' && raw !== null) {
              const usage = raw as Record<string, unknown>;
              usedHeapMB = megabytes(usage.usedSize);
              totalHeapMB = megabytes(usage.totalSize);
            }
          } catch {
            // The target may close or detach during collection.
          }
        }
        return { ...target.sample, usedHeapMB, totalHeapMB };
      })
    );
  }

  stop(): void {
    for (const target of this.targets) {
      try {
        if (
          !target.window.isDestroyed() &&
          !target.webContents.isDestroyed() &&
          target.debugSession.isAttached()
        )
          target.debugSession.detach();
      } catch {
        // Closing a renderer can detach its debugger before capture cleanup.
      }
    }
    this.targets = [];
  }
}
