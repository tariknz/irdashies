import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import logger from '../logger';

const FILE_NAME = 'pitLaneAnalytics.json';
const MAX_BYTES = 4096;
const HASH = /^[0-9a-f]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface PendingPitLaneCalibration {
  hash: string;
  distinctId: string;
  uuid: string;
  timestamp: string;
}

/** Bounded to one acknowledged hash and one pending event for this installation. */
export interface PitLaneAnalyticsCheckpoint {
  version: 1;
  distinctId: string;
  lastAcknowledgedHash: string | null;
  pending?: PendingPitLaneCalibration;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;
const isHash = (value: unknown): value is string =>
  typeof value === 'string' && HASH.test(value);
const isTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length !== 24) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
};

const checkpointFrom = (
  value: unknown
): PitLaneAnalyticsCheckpoint | undefined => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isId(value.distinctId) ||
    !(value.lastAcknowledgedHash === null || isHash(value.lastAcknowledgedHash))
  ) {
    return undefined;
  }
  const checkpoint: PitLaneAnalyticsCheckpoint = {
    version: 1,
    distinctId: value.distinctId,
    lastAcknowledgedHash: value.lastAcknowledgedHash,
  };
  if (value.pending !== undefined) {
    const pending = value.pending;
    if (
      !isRecord(pending) ||
      !isHash(pending.hash) ||
      pending.distinctId !== checkpoint.distinctId ||
      typeof pending.uuid !== 'string' ||
      !UUID.test(pending.uuid) ||
      !isTimestamp(pending.timestamp)
    ) {
      return undefined;
    }
    checkpoint.pending = {
      hash: pending.hash,
      distinctId: checkpoint.distinctId,
      uuid: pending.uuid,
      timestamp: pending.timestamp,
    };
  }
  return checkpoint;
};

const emptyCheckpoint = (distinctId: string): PitLaneAnalyticsCheckpoint => ({
  version: 1,
  distinctId,
  lastAcknowledgedHash: null,
});

/** Missing is a first launch; unreadable/invalid metadata must not cause a send. */
export const readPitLaneAnalyticsCheckpoint = async (
  distinctId: string
): Promise<PitLaneAnalyticsCheckpoint | undefined> => {
  try {
    const handle = await fs.open(
      path.join(app.getPath('userData'), FILE_NAME),
      'r'
    );
    try {
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(
          buffer,
          length,
          buffer.length - length,
          null
        );
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > MAX_BYTES) throw new Error('Oversized checkpoint');
      const parsed: unknown = JSON.parse(buffer.toString('utf8', 0, length));
      const checkpoint = checkpointFrom(parsed);
      if (!checkpoint) throw new Error('Invalid checkpoint');
      return checkpoint.distinctId === distinctId
        ? checkpoint
        : emptyCheckpoint(distinctId);
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return emptyCheckpoint(distinctId);
    }
    logger.warn('[Analytics] Could not read pit lane delivery checkpoint');
    return undefined;
  }
};

/**
 * Awaited before/after delivery instead of debounced: a retry must recover the
 * same event identity, and an acknowledged hash must never precede HTTP success.
 */
export const writePitLaneAnalyticsCheckpoint = async (
  checkpoint: PitLaneAnalyticsCheckpoint
): Promise<boolean> => {
  const target = path.join(app.getPath('userData'), FILE_NAME);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    const sanitized = checkpointFrom(checkpoint);
    if (!sanitized) throw new Error('Invalid checkpoint');
    const serialized = JSON.stringify(sanitized);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) {
      throw new Error('Oversized checkpoint');
    }
    const handle = await fs.open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, target);
    return true;
  } catch {
    logger.warn('[Analytics] Could not save pit lane delivery checkpoint');
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    return false;
  }
};
