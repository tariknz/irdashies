import { memo } from 'react';
import {
  ClockIcon,
  LightningIcon,
  LightningSlashIcon,
} from '@phosphor-icons/react';
import type { P2PDisplayState } from '@irdashies/context';

interface PushToPassCellProps {
  state?: P2PDisplayState;
}

const statusStyles = {
  inactive: {
    Icon: LightningIcon,
    weight: 'regular',
    label: 'ready',
    className:
      'bg-slate-800 text-emerald-100 inset-ring-1 inset-ring-emerald-300',
  },
  active: {
    Icon: LightningIcon,
    weight: 'fill',
    label: 'active',
    className: 'bg-emerald-300 text-slate-950',
  },
  cooldown: {
    Icon: ClockIcon,
    weight: 'bold',
    label: 'on cooldown',
    className: 'bg-sky-950 text-sky-200',
  },
  exhausted: {
    Icon: LightningSlashIcon,
    weight: 'fill',
    label: 'exhausted',
    className: 'bg-slate-900 text-slate-400',
  },
} as const;

const lowReserveClasses = {
  inactive:
    'bg-slate-950 text-amber-300 inset-ring-1 inset-ring-amber-300 inset-shadow-[2px_0_var(--color-amber-300)]',
  active: 'bg-amber-300 text-slate-950',
};

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
  // Keep large practice counts legible in clickthrough overlays, where hover
  // tooltips are unavailable, without overflowing into the next column.
  const remaining = status === 'exhausted' ? 0 : count;
  const displayedCount = remaining > 999 ? '999+' : remaining;
  const lowReserve =
    count <= 20 && (status === 'inactive' || status === 'active');
  const { Icon, weight, label, className } = statusStyles[status];
  const badgeClass = lowReserve ? lowReserveClasses[status] : className;

  return (
    <td
      data-column="pushToPass"
      className="w-[4.5rem] px-1 text-center align-middle"
      aria-label={`Push to Pass ${label}${lowReserve ? ', low reserve' : ''}, ${displayedCount} seconds remaining`}
    >
      <span
        className={`flex min-w-[4rem] items-center gap-0.5 px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${badgeClass}`}
      >
        <Icon size={12} weight={weight} aria-hidden="true" />
        <span className={`flex-1 text-right${lowReserve ? ' font-bold' : ''}`}>
          {displayedCount} s
        </span>
      </span>
    </td>
  );
});

PushToPassCell.displayName = 'PushToPassCell';
