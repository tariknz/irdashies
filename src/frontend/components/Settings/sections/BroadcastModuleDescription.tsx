import type { ReactNode } from 'react';

export const BroadcastModuleDescription = ({
  obsUrl,
  children,
}: {
  obsUrl?: string;
  children: ReactNode;
}) => (
  <>
    {children}
    {obsUrl && (
      <span className="mt-1 block">
        OBS URL for this module:{' '}
        <span className="select-all font-mono text-slate-300">{obsUrl}</span>
      </span>
    )}
  </>
);
