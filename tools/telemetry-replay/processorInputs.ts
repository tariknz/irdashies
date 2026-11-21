import * as yaml from 'js-yaml';
import type { Session, Telemetry } from '@irdashies/types';
import type { TelemetryFrame } from './validator';

export const parseSession = (text: string): Session =>
  yaml.load(text, { json: true }) as Session;

export const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;
