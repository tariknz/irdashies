import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { PitStopReport } from '@irdashies/types';
import logger from '../logger';
import { storageErrorCode } from './storageStatus';

export const MAX_REPORTS = 500;

/**
 * One JSON line per player pit stop, predicted against actual, for testers
 * to send back. Holds car, track, class and series numbers only, no names.
 */
export class PitStopReportLog {
  private chain: Promise<void> = Promise.resolve();
  private count: number | null = null;

  constructor(
    private readonly filePath: string,
    private readonly maxReports = MAX_REPORTS
  ) {}

  append(report: PitStopReport): Promise<void> {
    this.chain = this.chain
      .then(() => this.write(report))
      .catch((error) =>
        logger.error(
          'Failed to write pitStopReports.jsonl:',
          storageErrorCode(error)
        )
      );
    return this.chain;
  }

  flush(): Promise<void> {
    return this.chain;
  }

  private async lines(): Promise<string[]> {
    try {
      const content = await fsp.readFile(this.filePath, 'utf8');
      return content.split('\n').filter((line) => line.trim() !== '');
    } catch (error) {
      if (storageErrorCode(error) === 'ENOENT') return [];
      throw error;
    }
  }

  private async write(report: PitStopReport) {
    this.count ??= (await this.lines()).length;
    await fsp.appendFile(this.filePath, `${JSON.stringify(report)}\n`, 'utf8');
    this.count++;
    if (this.count <= this.maxReports) return;
    const kept = (await this.lines()).slice(-this.maxReports);
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fsp.writeFile(temporaryPath, `${kept.join('\n')}\n`, 'utf8');
    await fsp.rename(temporaryPath, this.filePath);
    this.count = kept.length;
  }
}

let reports: PitStopReportLog | null = null;

const getReportLog = () => {
  reports ??= new PitStopReportLog(
    path.join(app.getPath('userData'), 'pitStopReports.jsonl')
  );
  return reports;
};

export const appendPitStopReport = (report: PitStopReport) =>
  getReportLog().append(report);
export const flushPitStopReportsOnShutdown = () =>
  reports ? reports.flush() : Promise.resolve();
