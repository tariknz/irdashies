import { useEffect, useState } from 'react';

/** Browser visibility stays visible with backgroundThrottling:false on Electron. */
export const useNativeWindowVisibility = () => {
  const [visible, setVisible] = useState(true);
  useEffect(
    () => window.windowVisibilityBridge?.onVisibilityChanged(setVisible),
    []
  );
  return visible;
};
