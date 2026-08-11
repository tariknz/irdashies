import type { Session, StandingsSnapshot, Telemetry } from '@irdashies/types';
import { StandingsProcessor } from '../src/app/processors/StandingsProcessor';
import sessionFixture from '../src/app/irsdk/node/utils/mock-data/session.json';
import telemetryFixture from '../src/app/irsdk/node/utils/mock-data/telemetry.json';

const processor = new StandingsProcessor();
processor.init(sessionFixture as unknown as Session);
processor.onFrame(telemetryFixture as unknown as Telemetry);

export const standingsStorySnapshot: StandingsSnapshot = processor.snapshot();
