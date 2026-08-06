import { contextBridge, ipcMain, ipcRenderer } from 'electron';

/** Exposes a typed preload API through Electron's isolated world boundary. */
export const defineBridge = <I>(name: string, implementation: I): I => {
  contextBridge.exposeInMainWorld(name, implementation);
  return implementation;
};

export class RendererSubscriptionRegistry<K extends string> {
  private readonly subscriptions = new Map<number, Set<K>>();

  subscribe(rendererId: number, key: K): void {
    let keys = this.subscriptions.get(rendererId);
    if (!keys) {
      keys = new Set();
      this.subscriptions.set(rendererId, keys);
    }
    keys.add(key);
  }

  unsubscribe(rendererId: number, key: K): void {
    const keys = this.subscriptions.get(rendererId);
    keys?.delete(key);
    if (keys?.size === 0) this.subscriptions.delete(rendererId);
  }

  removeRenderer(rendererId: number): void {
    this.subscriptions.delete(rendererId);
  }

  has(rendererId: number, key: K): boolean {
    return this.subscriptions.get(rendererId)?.has(key) ?? false;
  }

  hasAny(key: K): boolean {
    for (const keys of this.subscriptions.values()) {
      if (keys.has(key)) return true;
    }
    return false;
  }

  clear(): void {
    this.subscriptions.clear();
  }
}

const subscriptionChannels = (name: string) => ({
  subscribe: `${name}:subscribe`,
  unsubscribe: `${name}:unsubscribe`,
});

export const createSubscriptionBridgeClient = <K extends string>(
  name: string
) => {
  const channels = subscriptionChannels(name);
  return {
    subscribe: (key: K) => ipcRenderer.invoke(channels.subscribe, key),
    unsubscribe: (key: K) => ipcRenderer.invoke(channels.unsubscribe, key),
  };
};

export const defineRendererSubscriptionBridge = <K extends string>(options: {
  name: string;
  isValidKey: (value: unknown) => value is K;
}) => {
  const channels = subscriptionChannels(options.name);
  const registry = new RendererSubscriptionRegistry<K>();
  const rendererCleanup = new Map<number, () => void>();

  ipcMain.handle(channels.subscribe, (event, key: unknown) => {
    if (!options.isValidKey(key)) {
      throw new Error(`Invalid ${options.name} subscription`);
    }
    const rendererId = event.sender.id;
    if (!rendererCleanup.has(rendererId)) {
      const cleanup = () => {
        event.sender.removeListener('destroyed', cleanup);
        event.sender.removeListener('did-start-loading', cleanup);
        rendererCleanup.delete(rendererId);
        registry.removeRenderer(rendererId);
      };
      rendererCleanup.set(rendererId, cleanup);
      event.sender.once('destroyed', cleanup);
      event.sender.once('did-start-loading', cleanup);
    }
    registry.subscribe(rendererId, key);
  });

  ipcMain.handle(channels.unsubscribe, (event, key: unknown) => {
    if (!options.isValidKey(key)) {
      throw new Error(`Invalid ${options.name} unsubscribe`);
    }
    registry.unsubscribe(event.sender.id, key);
  });

  return {
    registry,
    dispose: () => {
      ipcMain.removeHandler(channels.subscribe);
      ipcMain.removeHandler(channels.unsubscribe);
      for (const cleanup of rendererCleanup.values()) cleanup();
      rendererCleanup.clear();
      registry.clear();
    },
  };
};
