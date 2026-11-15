/** Native BrowserWindow visibility; distinct from document.visibilityState. */
export interface WindowVisibilityBridge {
  onVisibilityChanged: (callback: (visible: boolean) => void) => () => void;
}
