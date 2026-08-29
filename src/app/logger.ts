import logger from 'electron-log/main';
import path from 'node:path';

logger.initialize();

// File: info and above (persisted to disk)
// Console: debug and above (visible in dev)
//
// Startup instrumentation logs at debug, which the file transport drops by
// default so ordinary runs do not bloat the log. Set IRDASHIES_LOG_LEVEL=debug
// to capture it when diagnosing a slow or empty startup.
const FILE_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug'] as const;
type FileLevel = (typeof FILE_LEVELS)[number];

const requestedLevel = process.env.IRDASHIES_LOG_LEVEL as FileLevel | undefined;
logger.transports.file.level =
  requestedLevel && FILE_LEVELS.includes(requestedLevel)
    ? requestedLevel
    : 'info';
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
