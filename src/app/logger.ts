import logger from 'electron-log/main';
import path from 'node:path';

logger.initialize();

// File: info and above (persisted to disk)
// Console: debug and above (visible in dev)
logger.transports.file.level = 'info';
logger.transports.console.level = 'debug';

const perfLogPath = process.env.PERF_LOG_PATH;
if (perfLogPath) {
  // Packaged Electron apps do not reliably forward console output to the
  // spawning process. Give each benchmark run a dedicated file so the runner
  // can analyse the exact structured samples emitted by that app instance.
  const resolvedPerfLogPath = path.resolve(perfLogPath);
  logger.transports.file.resolvePathFn = () => resolvedPerfLogPath;
}

// Rotate at 5MB to prevent disk bloat
logger.transports.file.maxSize = 5 * 1024 * 1024;

// Re-export the instance directly — do NOT wrap methods,
// so electron-log can capture the real call-site stack trace.
export default logger;
