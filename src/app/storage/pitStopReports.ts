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
  private needsSeparator = false;

  constructor(
    private readonly filePath: string,
    private readonly maxReports = MAX_REPORTS
  ) {}

  append(report: PitStopReport): Promise<void> {
    return this.enqueue(() => this.write(report));
  }

  flush(): Promise<void> {
    return this.enqueue(() => this.compact());
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.chain = this.chain
      .then(task)
      .catch((error) =>
        logger.error(
          'Failed to write pitStopReports.jsonl:',
          storageErrorCode(error)
        )
      );
    return this.chain;
  }

  private async content(): Promise<string> {
    try {
      return await fsp.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (storageErrorCode(error) === 'ENOENT') return '';
      throw error;
    }
  }

  private async lines(): Promise<string[]> {
    return (await this.content())
      .split('\n')
      .filter((line) => line.trim() !== '');
  }

  private async write(report: PitStopReport) {
    if (this.count === null) {
      const content = await this.content();
      this.count = content
        .split('\n')
        .filter((line) => line.trim() !== '').length;
      this.needsSeparator = content.length > 0 && !content.endsWith('\n');
    }
    const separator = this.needsSeparator ? '\n' : '';
    await fsp.appendFile(
      this.filePath,
      `${separator}${JSON.stringify(report)}\n`,
      'utf8'
    );
    this.needsSeparator = false;
    this.count++;
    await this.compact();
  }

  private async compact() {
    if (this.count === null || this.count <= this.maxReports) return;
    const kept = (await this.lines()).slice(-this.maxReports);
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    try {
      await fsp.writeFile(temporaryPath, `${kept.join('\n')}\n`, 'utf8');
      await fsp.rename(temporaryPath, this.filePath);
    } catch (error) {
      await fsp.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
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
