import { createReportHashFile } from './reportHashFile';

export const {
  read: readLmuSectorBoundaryReportHash,
  write: writeLmuSectorBoundaryReportHash,
  flush: flushLmuSectorBoundaryReportHash,
} = createReportHashFile(
  'lmu-sector-boundary-report-hash.txt',
  '[LmuSectorBoundaries]'
);
