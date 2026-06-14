import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, 'docs/assets/icons/logo'),
    extraResource: [path.resolve(__dirname, 'docs/assets/icons')],
  },
  rebuildConfig: {
    force: true,
    // @kmamal/sdl ships a prebuilt N-API binary (ABI-stable across Node and
    // Electron). Forcing a source rebuild fails because SDL itself isn't present
    // to compile against, so skip it and use the shipped dist/sdl.node.
    ignoreModules: ['@kmamal/sdl'],
  },
  makers: [
    new MakerSquirrel({
      iconUrl: path.resolve(__dirname, 'docs/assets/icons/logo.ico'),
      setupIcon: path.resolve(__dirname, 'docs/assets/icons/logo.ico'),
    }),
    new MakerDMG({
      icon: path.resolve(__dirname, 'docs/assets/icons/logo.icns'),
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'tariknz',
          name: 'irdashies',
        },
        prerelease: true,
      },
    },
  ],
  plugins: [
    // Unpack native modules (e.g. @kmamal/sdl) from the asar so their .node
    // binaries can be loaded at runtime.
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
