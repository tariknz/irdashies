import logger from 'electron-log/main';

logger.initialize();

// File: info and above (persisted to disk)
// Console: debug and above (visible in dev)
logger.transports.file.level = 'info';
logger.transports.console.level = 'debug';

// Rotate at 5MB to prevent disk bloat
logger.transports.file.maxSize = 5 * 1024 * 1024;

// Re-export the instance directly — do NOT wrap methods,
// so electron-log can capture the real call-site stack trace.
export default logger;
