import { shell } from 'electron';
import type { WebContents } from 'electron';
import logger from './logger';

/**
 * The subset of `BrowserWindow` this helper touches. Narrow so the rules can be
 * unit-tested without an Electron window.
 */
export interface HardenableWindow {
  webContents: Pick<WebContents, 'setWindowOpenHandler' | 'on'>;
}

export interface HardenWindowOptions {
  /** Vite dev-server origin, when running unpackaged. */
  devServerUrl?: string;
  /** Exact packaged renderer document allowed to retain the preload. */
  packagedRendererUrl?: string;
  /** Name used in logs when a navigation is blocked. */
  label?: string;
  /** Injected for tests. */
  openExternal?: (url: string) => void;
}

/**
 * Renderer-initiated navigation the window is allowed to follow: the packaged
 * bundle (file://) or, in development, the Vite dev server. Hash-only route
 * changes never reach `will-navigate`, so this does not affect routing.
 */
export const isInternalAppUrl = (
  url: string,
  devServerUrl?: string,
  packagedRendererUrl?: string
): boolean => {
  try {
    const candidate = new URL(url);
    if (devServerUrl) {
      return candidate.origin === new URL(devServerUrl).origin;
    }
    if (!packagedRendererUrl) return false;
    const packagedRenderer = new URL(packagedRendererUrl);
    return (
      candidate.protocol === packagedRenderer.protocol &&
      candidate.host === packagedRenderer.host &&
      candidate.pathname === packagedRenderer.pathname
    );
  } catch {
    return false;
  }
};

/**
 * Apply the baseline security handlers every window carrying the app preload
 * must have: no uncontrolled popups, and no navigating away from the bundle.
 *
 * External http(s) links (the About tab's GitHub/Discord links) are handed to
 * the system browser rather than opened in a privileged Electron window.
 */
export const hardenWindow = (
  window: HardenableWindow,
  options: HardenWindowOptions = {}
): void => {
  const {
    devServerUrl,
    packagedRendererUrl,
    label = 'window',
    openExternal,
  } = options;
  const openInBrowser =
    openExternal ??
    ((url: string) =>
      void shell
        .openExternal(url)
        .catch((err) =>
          logger.error(`[${label}] Failed to open ${url} externally`, err)
        ));

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      openInBrowser(url);
    } else {
      logger.warn(`[${label}] Blocked window.open to ${url}`);
    }
    return { action: 'deny' };
  });

  const blockExternalNavigation = (
    event: { preventDefault: () => void },
    url: string
  ) => {
    if (isInternalAppUrl(url, devServerUrl, packagedRendererUrl)) return;
    logger.warn(`[${label}] Blocked navigation to ${url}`);
    event.preventDefault();
  };

  window.webContents.on('will-navigate', blockExternalNavigation);
  // 3xx responses fire will-redirect, not will-navigate.
  window.webContents.on('will-redirect', blockExternalNavigation);
};
