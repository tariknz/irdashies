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
        className="w-16 px-1 text-center align-middle"
      />
    );
  }

  const { status, count } = state;

  const isExhausted = status === 'exhausted';
  const isActive = status === 'active';
  const isCooldown = status === 'cooldown';
  const isActiveHighCount = isActive && count <= 20;

  const getBgClass = () => {
    if (isExhausted) return 'bg-red-500/80 text-white';
    if (isCooldown) return 'bg-sky-500 text-slate-800';
    if (isActiveHighCount) return 'bg-red-500 text-white';
    if (isActive) return 'bg-lime-500 text-slate-800';
    if (count <= 20) return 'bg-red-200 text-slate-800';
    return 'bg-lime-200 text-slate-800';
  };

  const bgClass = getBgClass();

  const pulseClass = isActive || isCooldown ? 'animate-pulse' : '';

  const iconClass = isActiveHighCount
    ? 'text-white'
    : isActive
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
    <td data-column="pushToPass" className="w-16 px-1 text-center align-middle">
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs w-14 ${bgClass} ${pulseClass}`}
      >
        <span className={iconClass}>{icon}</span>
        <span className="flex-1 text-right text-nowrap">
          {isExhausted ? 0 : count} s
        </span>
      </span>
    </td>
  );
});

PushToPassCell.displayName = 'PushToPassCell';
