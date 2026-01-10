import { useEffect, useState, type ReactNode } from 'react';

declare global {
  interface Window {
    globalKey?: {
      onToggle: (cb: (hide: boolean) => void) => () => void;
    };
  }
}

interface HideUIWrapperProps {
  children: ReactNode;
}

export const HideUIWrapper = ({ children }: HideUIWrapperProps) => {
  const [hideUI, setHideUI] = useState(false);

  useEffect(() => {
    if (!window.globalKey?.onToggle) return;

    const unsub = window.globalKey.onToggle((hide) => setHideUI(hide));
    return () => unsub();
  }, []);

  if (hideUI) {
    return <></>;
  }

  return children;
};
