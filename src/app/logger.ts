import log from 'electron-log/main';

log.initialize();

// File: info and above (persisted to disk)
// Console: debug and above (visible in dev)
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Rotate at 5MB to prevent disk bloat
log.transports.file.maxSize = 5 * 1024 * 1024;

// Re-export the instance directly — do NOT wrap methods,
// so electron-log can capture the real call-site stack trace.
export default log;
