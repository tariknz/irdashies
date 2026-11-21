import os from 'node:os';

export interface HostFacts {
  hostPlatform: string;
  hostArch: string;
  hostRelease: string;
  hostCpuModel: string;
  hostLogicalCores: number;
  hostTotalMemoryGB: number;
  hostDisplayServer: 'wayland' | 'x11' | 'headless';
}

export function collectHostFacts(): HostFacts {
  const cpus = os.cpus();
  const displayServer =
    process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland'
      ? 'wayland'
      : process.env.DISPLAY || process.env.XDG_SESSION_TYPE === 'x11'
        ? 'x11'
        : 'headless';
  return {
    hostPlatform: process.platform,
    hostArch: process.arch,
    hostRelease: os.release(),
    hostCpuModel: cpus[0]?.model ?? 'unknown',
    hostLogicalCores: cpus.length,
    hostTotalMemoryGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    hostDisplayServer: displayServer,
  };
}
