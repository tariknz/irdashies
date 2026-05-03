import { memo } from 'react';
import { BarbellIcon } from '@phosphor-icons/react';
import { useFocusedDriver, useCarClassStats } from '@irdashies/context';

export const SofItem = memo(() => {
  const focusedDriver = useFocusedDriver();
  const classStats = useCarClassStats();
  const classId = focusedDriver?.carClassID;
  const stats = classId !== undefined ? classStats?.[classId] : undefined;
  if (!stats?.sof) return null;
  return (
    <div className="flex justify-center gap-1 items-center">
      <BarbellIcon className="text-white/60" />
      <span>{stats.sof}</span>
    </div>
  );
});
SofItem.displayName = 'SofItem';
