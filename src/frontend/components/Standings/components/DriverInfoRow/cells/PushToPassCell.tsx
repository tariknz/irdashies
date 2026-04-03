import { memo } from 'react';
import { LightningIcon, LightningSlashIcon } from '@phosphor-icons/react';
import type { P2PDisplayState } from '@irdashies/context';

interface PushToPassCellProps {
  state?: P2PDisplayState;
}

export const PushToPassCell = memo(({ state }: PushToPassCellProps) => {
  if (!state) {
    return (
      <td
        data-column="pushToPass"
        className="w-[4.5rem] px-1 text-center align-middle"
      />
    );
  }

  const { status, count } = state;

  const isExhausted = status === 'exhausted';
  const isActive = status === 'active';
  const isCooldown = status === 'cooldown';

  const bgClass = isExhausted
    ? 'bg-red-500/80 text-white'
    : isCooldown
      ? 'bg-blue-300/80 text-slate-800'
      : 'bg-green-200/80 text-slate-800';

  const pulseClass = isActive || isCooldown ? 'animate-pulse' : '';

  const iconClass = isActive
    ? 'text-amber-500'
    : isExhausted
      ? 'text-white'
      : 'text-black';

  const icon = isExhausted ? (
    <LightningSlashIcon size={12} weight="fill" />
  ) : (
    <LightningIcon size={12} weight="fill" />
  );

  return (
    <td
      data-column="pushToPass"
      className="w-[4.5rem] px-1 text-center align-middle"
    >
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${bgClass} ${pulseClass}`}
      >
        <span className={iconClass}>{icon}</span>
        {isExhausted ? 0 : count}
      </span>
    </td>
  );
});

PushToPassCell.displayName = 'PushToPassCell';
