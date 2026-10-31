import { useEffect, useState } from 'react';
import { WarningCircleIcon } from '@phosphor-icons/react';

export const StorageStatusNotice = () => {
  const [diskFull, setDiskFull] = useState(false);
  useEffect(
    () =>
      window.storageStatusBridge?.onStatus((status) => {
        setDiskFull(status.diskFull);
      }),
    []
  );

  if (!diskFull) return null;
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-3 rounded-md border border-amber-500/50 bg-amber-950/60 p-3 text-amber-100"
    >
      <WarningCircleIcon size={22} className="shrink-0" />
      <div>
        <p className="font-semibold">Disk full — data cannot be saved</p>
        <p className="text-sm">
          Fuel history or reference laps cannot be saved. Free disk space to
          resume saving.
        </p>
      </div>
    </div>
  );
};
