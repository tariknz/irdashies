import { launchReplay } from './launch-replay.mjs';

launchReplay({
  command: 'lmu:replay:app',
  extension: '.lmudt',
  tapeName: 'LMU',
  envPrefix: 'IRDASHIES_LMU_REPLAY',
  sim: 'lmu',
});
