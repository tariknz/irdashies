import { api } from '@electron-forge/core';

await api.publish({
  dryRun: true,
  makeOptions: {
    skipPackage: true,
  },
});
