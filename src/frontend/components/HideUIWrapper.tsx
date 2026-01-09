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

  return <div className={hideUI ? 'opacity-0 pointer-events-none transition-opacity duration-100 ease-linear' : ''}>{children}</div>;
};
