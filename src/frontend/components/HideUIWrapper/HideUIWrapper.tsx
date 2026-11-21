import { useEffect, useState, type ReactNode } from 'react';

interface HideUIWrapperProps {
  children: ReactNode;
}

export const HideUIWrapper = ({ children }: HideUIWrapperProps) => {
  const [hideUI, setHideUI] = useState(false);

  useEffect(() => {
    return window.globalKey?.onToggle?.(setHideUI);
  }, []);

  if (hideUI) {
    return <></>;
  }

  return children;
};
