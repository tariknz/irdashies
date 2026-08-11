export type RendererDataStream = 'sessionData' | 'telemetryInspector';

export interface RendererDataSubscriptions {
  has(rendererId: number, stream: RendererDataStream): boolean;
  hasAny(stream: RendererDataStream): boolean;
}

interface RendererDataWindow {
  isDestroyed(): boolean;
  isVisible(): boolean;
  webContents: {
    id: number;
    send(channel: string, value: unknown): void;
  };
}

export const refreshSessionDataForVisibleWindow = (
  win: RendererDataWindow,
  subscriptions: RendererDataSubscriptions | undefined,
  latestSessionData: unknown
): boolean => {
  if (
    latestSessionData === undefined ||
    win.isDestroyed() ||
    !win.isVisible() ||
    !subscriptions?.has(win.webContents.id, 'sessionData')
  ) {
    return false;
  }
  win.webContents.send('sessionData', latestSessionData);
  return true;
};
