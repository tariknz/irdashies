import { createReportHashFile } from './reportHashFile';

export const {
  read: readRadarPoleSideReportHash,
  write: writeRadarPoleSideReportHash,
  flush: flushRadarPoleSideReportHash,
} = createReportHashFile('radar-pole-side-report-hash.txt', '[RadarPoleSide]');
