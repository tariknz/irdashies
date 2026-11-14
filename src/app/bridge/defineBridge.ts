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

  hasRenderer(rendererId: number): boolean {
    return this.subscriptions.has(rendererId);
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

/**
 * A value main pushes to the windows subscribed to it, as one subscription
 * per page that every consumer in the page shares; callbacks never live in
 * main.
 *
 * Each consumer still sends its own subscribe: a bridge whose main side
 * replies to a subscribe with the current value is how a late consumer learns
 * it without waiting for the next change. Only the last consumer leaving
 * unsubscribes. What arrives is checked by `parse` before any consumer sees
 * it, and a failed (un)subscribe is logged rather than left as an unhandled
 * rejection in the preload.
 */
export const createSharedSubscription = <K extends string, T>(options: {
  /** The subscription bridge's name in main. */
  name: string;
  key: K;
  /** The channel main sends the value on. */
  channel: string;
  /** The value to hand to consumers, or undefined to drop what arrived. */
  parse: (value: unknown) => T | undefined;
  /** Starts the logged warnings, e.g. '[Storage] Status'. */
  label: string;
}) => {
  const client = createSubscriptionBridgeClient<K>(options.name);
  const warn = (message: string) => () =>
    ipcRenderer.send('log', 'warn', `${options.label} ${message}`);
  let consumers = 0;
  return (callback: (value: T) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
      const parsed = options.parse(value);
      if (parsed !== undefined) callback(parsed);
    };
    ipcRenderer.on(options.channel, listener);
    consumers++;
    void client.subscribe(options.key).catch(warn('subscription failed'));
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      ipcRenderer.removeListener(options.channel, listener);
      if (--consumers === 0) {
        void client.unsubscribe(options.key).catch(warn('unsubscribe failed'));
      }
    };
  };
};

/**
 * Calls `onGone` once the page in `contents` is gone: the contents was
 * destroyed, or its main frame started loading another document.
 *
 * `did-start-loading` is not used for the second: Chromium also fires it for
 * every iframe load, so a page would lose its state each time an iframe in it
 * loaded or reloaded. Same-document navigations (hash routes, pushState) keep
 * the page too.
 */
export const onRendererPageGone = (
  contents: Electron.WebContents,
  onGone: () => void
): (() => void) => {
  const onNavigate = (
    _event: Electron.Event,
    _url: string,
    isInPlace: boolean,
    isMainFrame: boolean
  ) => {
    if (isMainFrame && !isInPlace) gone();
  };
  const detach = () => {
    contents.removeListener('destroyed', gone);
    contents.removeListener('did-start-navigation', onNavigate);
  };
  function gone() {
    detach();
    onGone();
  }
  contents.on('destroyed', gone);
  contents.on('did-start-navigation', onNavigate);
  return detach;
};

export const defineRendererSubscriptionBridge = <K extends string>(options: {
  name: string;
  isValidKey: (value: unknown) => value is K;
  onSubscribe?: (sender: Electron.WebContents, key: K) => void;
  /** After the renderer asked to stop; not when its page goes away. */
  onUnsubscribe?: (sender: Electron.WebContents, key: K) => void;
}) => {
  const channels = subscriptionChannels(options.name);
  const registry = new RendererSubscriptionRegistry<K>();
  const rendererCleanup = new Map<number, () => void>();

  /** Forgets the renderer, and stops watching its page. */
  const releaseRenderer = (rendererId: number) => {
    rendererCleanup.get(rendererId)?.();
    rendererCleanup.delete(rendererId);
    registry.removeRenderer(rendererId);
  };

  ipcMain.handle(channels.subscribe, (event, key: unknown) => {
    if (!options.isValidKey(key)) {
      throw new Error(`Invalid ${options.name} subscription`);
    }
    const rendererId = event.sender.id;
    if (!rendererCleanup.has(rendererId)) {
      rendererCleanup.set(
        rendererId,
        onRendererPageGone(event.sender, () => releaseRenderer(rendererId))
      );
    }
    registry.subscribe(rendererId, key);
    options.onSubscribe?.(event.sender, key);
  });

  ipcMain.handle(channels.unsubscribe, (event, key: unknown) => {
    if (!options.isValidKey(key)) {
      throw new Error(`Invalid ${options.name} unsubscribe`);
    }
    const rendererId = event.sender.id;
    registry.unsubscribe(rendererId, key);
    // Nothing left to clean up when its page goes away.
    if (!registry.hasRenderer(rendererId)) releaseRenderer(rendererId);
    options.onUnsubscribe?.(event.sender, key);
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
