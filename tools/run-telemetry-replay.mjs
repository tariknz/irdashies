import { launchReplay } from './launch-replay.mjs';

launchReplay({
  command: 'irsdk:replay:app',
  extension: '.irdt',
  tapeName: 'telemetry',
  envPrefix: 'IRDASHIES_TELEMETRY_REPLAY',
});
