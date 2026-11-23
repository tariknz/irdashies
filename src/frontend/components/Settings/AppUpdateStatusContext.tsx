import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppUpdateStatus } from '@irdashies/types';

const AppUpdateStatusContext = createContext<AppUpdateStatus | undefined>(
  undefined
);

export const AppUpdateStatusProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const bridge = window.appUpdatesBridge;
  const [status, setStatus] = useState<AppUpdateStatus>();
  useEffect(() => bridge?.onStatus(setStatus), [bridge]);

  return (
    <AppUpdateStatusContext value={status}>{children}</AppUpdateStatusContext>
  );
};

export const useAppUpdateStatus = () => useContext(AppUpdateStatusContext);
