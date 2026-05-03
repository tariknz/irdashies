import { memo } from 'react';
import { UsersIcon } from '@phosphor-icons/react';
import { useFocusedDriver, useCarClassStats } from '@irdashies/context';

export const ClassDriversItem = memo(() => {
  const focusedDriver = useFocusedDriver();
  const classStats = useCarClassStats();
  const classId = focusedDriver?.carClassID;
  const stats = classId !== undefined ? classStats?.[classId] : undefined;
  if (!stats?.total) return null;
  return (
    <div className="flex justify-center gap-1 items-center">
      <UsersIcon className="text-white/60" />
      <span>{stats.total}</span>
    </div>
  );
});
ClassDriversItem.displayName = 'ClassDriversItem';
