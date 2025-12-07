import { app, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import v8 from 'node:v8';

interface MemoryReport {
  timestamp: string;
  main: NodeJS.MemoryUsage;
  renderers: {
    id: number;
    title: string;
    memory: Electron.ProcessMemoryInfo;
  }[];
  system: Electron.ProcessMemoryInfo;
  summary: {
    totalMB: number;
    mainHeapMB: number;
    renderersPrivateMB: number;
  };
}

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

export async function getMemoryReport(): Promise<MemoryReport> {
  const mainMemory = process.memoryUsage();
  const systemMemory = await process.getProcessMemoryInfo();

  const renderers: MemoryReport['renderers'] = [];
  let totalRendererPrivate = 0;

  for (const win of BrowserWindow.getAllWindows()) {
    try {
      const memInfo = await win.webContents.executeJavaScript(`
        (async () => {
          if (performance.measureUserAgentSpecificMemory) {
            const mem = await performance.measureUserAgentSpecificMemory();
            return { bytes: mem.bytes, breakdown: mem.breakdown };
          }
          return { bytes: performance.memory?.usedJSHeapSize || 0 };
        })()
      `);

      renderers.push({
        id: win.webContents.id,
        title: win.getTitle() || `Window ${win.webContents.id}`,
        memory: {
          private: memInfo.bytes || 0,
          shared: 0,
          residentSet: 0,
        },
      });
      totalRendererPrivate += memInfo.bytes || 0;
    } catch {
      // Window might be closed or not ready
    }
  }

  return {
    timestamp: new Date().toISOString(),
    main: mainMemory,
    renderers,
    system: systemMemory,
    summary: {
      totalMB: parseFloat(formatMB(systemMemory.private * 1024)),
      mainHeapMB: parseFloat(formatMB(mainMemory.heapUsed)),
      renderersPrivateMB: parseFloat(formatMB(totalRendererPrivate)),
    },
  };
}

export async function logMemoryUsage(): Promise<void> {
  const report = await getMemoryReport();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🧠 MEMORY USAGE REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📦 MAIN PROCESS:');
  console.log(`   Heap Used:      ${formatMB(report.main.heapUsed)} MB`);
  console.log(`   Heap Total:     ${formatMB(report.main.heapTotal)} MB`);
  console.log(`   RSS:            ${formatMB(report.main.rss)} MB`);
  console.log(`   External:       ${formatMB(report.main.external)} MB`);
  console.log(`   Array Buffers:  ${formatMB(report.main.arrayBuffers)} MB`);

  console.log('\n🖼️  RENDERER PROCESSES:');
  for (const renderer of report.renderers) {
    console.log(`   ${renderer.title}:`);
    console.log(`      JS Heap: ${formatMB(renderer.memory.private)} MB`);
  }

  console.log('\n📊 SUMMARY:');
  console.log(`   Total Process Memory: ${report.summary.totalMB} MB`);
  console.log(`   Main Heap Used:       ${report.summary.mainHeapMB} MB`);
  console.log(`   Renderers JS Heap:    ${report.summary.renderersPrivateMB} MB`);
  console.log('');
}

export async function takeHeapSnapshot(): Promise<string> {
  const desktopPath = app.getPath('desktop');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(
    desktopPath,
    `irdashies-heap-${timestamp}.heapsnapshot`
  );

  // Take V8 heap snapshot of the main process
  v8.writeHeapSnapshot(snapshotPath);

  console.log(`Heap snapshot saved to: ${snapshotPath}`);
  console.log('Open this file in Chrome DevTools > Memory tab to analyze');

  return snapshotPath;
}

export async function saveMemoryReport(): Promise<string> {
  const report = await getMemoryReport();
  const desktopPath = app.getPath('desktop');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(
    desktopPath,
    `irdashies-memory-${timestamp}.json`
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`Memory report saved to: ${reportPath}`);

  return reportPath;
}

export async function forceGC(): Promise<void> {
  if (global.gc) {
    console.log('Forcing garbage collection...');
    global.gc();
    console.log('GC complete');
    await logMemoryUsage();
  } else {
    console.log('GC not exposed. Run with --expose-gc flag to enable.');
  }
}
