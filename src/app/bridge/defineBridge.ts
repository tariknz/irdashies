import { contextBridge } from 'electron';

/** Exposes a typed preload API through Electron's isolated world boundary. */
export const defineBridge = <I>(name: string, implementation: I): I => {
  contextBridge.exposeInMainWorld(name, implementation);
  return implementation;
};
