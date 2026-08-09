import type { Session, SessionBarSnapshot, Telemetry } from '@irdashies/types';
import { SessionBarProcessor } from '../src/app/processors/SessionBarProcessor';
import sessionFixture from '../src/app/irsdk/node/utils/mock-data/session.json';
import telemetryFixture from '../src/app/irsdk/node/utils/mock-data/telemetry.json';

const processor = new SessionBarProcessor();
processor.init(sessionFixture as unknown as Session);
processor.onFrame(telemetryFixture as unknown as Telemetry);

export const sessionBarStorySnapshot: SessionBarSnapshot = processor.snapshot();
