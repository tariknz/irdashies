import type { LapTimesSnapshot, ReferenceLapsSnapshot } from '@irdashies/types';
import type { ReferenceLapPersistence } from './ReferenceLapProcessor';
import { CarSpeedsProcessor } from './CarSpeedsProcessor';
import { BlindSpotProcessor } from './BlindSpotProcessor';
import { DriverControlsProcessor } from './DriverControlsProcessor';
import { FuelProjectionProcessor } from './FuelProjectionProcessor';
import { LapLogProcessor } from './LapLogProcessor';
import { LapTimesProcessor } from './LapTimesProcessor';
import type {
  AnyProcessorDefinition,
  ProcessorMetrics,
  ProcessorDefinition,
} from './ProcessorHost';
import { ProcessorHost } from './ProcessorHost';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { RadioProcessor } from './RadioProcessor';
import { ReferenceLapProcessor } from './ReferenceLapProcessor';
import { RelativeGapProcessor } from './RelativeGapProcessor';
import { SectorTimingProcessor } from './SectorTimingProcessor';
import { SessionBarProcessor } from './SessionBarProcessor';
import { SessionTimingProcessor } from './SessionTimingProcessor';
import { StandingsProcessor } from './StandingsProcessor';
import { TrackStateProcessor } from './TrackStateProcessor';

interface ProcessorRegistryOptions {
  referenceLapPersistence: ReferenceLapPersistence;
}

interface DefaultProcessorHostOptions extends ProcessorRegistryOptions {
  bus: ChannelBus;
  lifecycle?: SessionLifecycle;
  metrics: ProcessorMetrics;
  aggregateReplay?: boolean;
}

const noReferenceLaps: ReferenceLapsSnapshot = {
  bestLaps: [],
  persistedLaps: [],
  sessionNum: null,
  version: 0,
};

const noLapTimes: LapTimesSnapshot = {
  lapTimes: [],
  lapTimeHistory: [],
  sessionNum: null,
  version: 0,
};

const defineProcessor = <K extends AnyProcessorDefinition['channel']>(
  definition: ProcessorDefinition<K>
): ProcessorDefinition<K> => definition;

export const createProcessorDefinitions = ({
  referenceLapPersistence,
}: ProcessorRegistryOptions): readonly AnyProcessorDefinition[] => [
  defineProcessor({
    channel: 'blind-spot.snapshot',
    metricsPrefix: 'blindSpot',
    create: () => new BlindSpotProcessor(),
  }),
  defineProcessor({
    channel: 'fuel.projection',
    metricsPrefix: 'fuelProjection',
    create: ({ sourceReplay }) => new FuelProjectionProcessor({ sourceReplay }),
  }),
  defineProcessor({
    channel: 'lap-times.snapshot',
    metricsPrefix: 'lapTimes',
    create: () => new LapTimesProcessor(),
  }),
  defineProcessor({
    channel: 'car-speeds.snapshot',
    metricsPrefix: 'carSpeeds',
    create: () => new CarSpeedsProcessor(),
  }),
  defineProcessor({
    channel: 'reference-laps.snapshot',
    retainWhenInactive: true,
    metricsPrefix: 'referenceLap',
    create: ({ aggregateReplay }) =>
      new ReferenceLapProcessor(
        aggregateReplay
          ? { load: () => null, save: () => undefined }
          : referenceLapPersistence
      ),
  }),
  defineProcessor({
    channel: 'relative-gaps.snapshot',
    dependencies: ['reference-laps.snapshot'],
    metricsPrefix: 'relativeGap',
    create: ({ snapshot }) =>
      new RelativeGapProcessor({
        snapshot: () => snapshot('reference-laps.snapshot') ?? noReferenceLaps,
      }),
  }),
  defineProcessor({
    channel: 'sector-timing.snapshot',
    metricsPrefix: 'sectorTiming',
    create: () => new SectorTimingProcessor(),
  }),
  defineProcessor({
    channel: 'standings.snapshot',
    metricsPrefix: 'standings',
    create: () => new StandingsProcessor(),
  }),
  defineProcessor({
    channel: 'radio.snapshot',
    metricsPrefix: 'radio',
    create: () => new RadioProcessor(),
  }),
  defineProcessor({
    channel: 'session-timing.snapshot',
    dependencies: ['lap-times.snapshot'],
    metricsPrefix: 'sessionTiming',
    create: ({ snapshot }) =>
      new SessionTimingProcessor(
        () => (snapshot('lap-times.snapshot') ?? noLapTimes).lapTimes
      ),
  }),
  defineProcessor({
    channel: 'session-bar.snapshot',
    metricsPrefix: 'sessionBar',
    create: () => new SessionBarProcessor(),
  }),
  defineProcessor({
    channel: 'driver-controls.snapshot',
    metricsPrefix: 'driverControls',
    create: () => new DriverControlsProcessor(),
  }),
  defineProcessor({
    channel: 'track-state.snapshot',
    metricsPrefix: 'trackState',
    create: () => new TrackStateProcessor(),
  }),
  defineProcessor({
    channel: 'lap-log.snapshot',
    metricsPrefix: 'lapLog',
    create: () => new LapLogProcessor(),
  }),
];

export const createDefaultProcessorHost = (
  options: DefaultProcessorHostOptions
): ProcessorHost =>
  new ProcessorHost({
    bus: options.bus,
    lifecycle: options.lifecycle,
    metrics: options.metrics,
    aggregateReplay: options.aggregateReplay,
    definitions: createProcessorDefinitions(options),
  });
