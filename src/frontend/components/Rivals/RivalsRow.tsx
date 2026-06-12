import { memo } from 'react';
import { formatTime } from '@irdashies/utils/time';
import { RivalsConfig } from '@irdashies/types';
import { useRivalSectorDeltas, type SectorDelta } from '@irdashies/context';
import { RivalEntry } from './hooks/useRivalsData';

export type RivalColumnId =
  | 'gap'
  | 'lastTime'
  | 'lastTimeDiff'
  | 'bestTime'
  | 'bestTimeDiff';

export const RIVAL_COLUMN_IDS: RivalColumnId[] = [
  'gap',
  'lastTime',
  'lastTimeDiff',
  'bestTime',
  'bestTimeDiff',
];

export const RIVAL_COLUMN_META: Record<RivalColumnId, { header: string }> = {
  gap: { header: 'Gap' },
  lastTime: { header: 'Last Lap' },
  lastTimeDiff: { header: 'Delta' },
  bestTime: { header: 'Best Lap' },
  bestTimeDiff: { header: 'Best Delta' },
};

interface RivalsRowProps {
  rival: RivalEntry | undefined;
  config: RivalsConfig;
  displayOrder: RivalColumnId[];
  playerCarIdx: number | undefined;
}

const CELL = 'w-16 text-right shrink-0 tabular-nums';

const DiffCell = ({ value }: { value: number | undefined }) => {
  if (value === undefined) return <span className="text-slate-500">—</span>;
  const sign = value > 0 ? '+' : '';
  // Red when rival is faster (negative diff = rival's time < player's time)
  const color =
    value < 0 ? 'text-red-400' : value > 0 ? 'text-green-400' : 'text-slate-300';
  return (
    <span className={color}>
      {sign}
      {formatTime(Math.abs(value), 'seconds-full')}
    </span>
  );
};

const ColCell = ({
  colId,
  rival,
  config,
}: {
  colId: RivalColumnId;
  rival: RivalEntry;
  config: RivalsConfig;
}) => {
  switch (colId) {
    case 'gap': {
      if (!config.gap.enabled) return null;
      const gapAbs = Math.abs(rival.delta ?? 0);
      const gapSign = rival.relativePct > 0 ? '+' : '-';
      return (
        <span className={`${CELL} text-slate-200`}>
          {gapSign}
          {formatTime(gapAbs, 'seconds-full')}
        </span>
      );
    }
    case 'lastTime':
      if (!config.lastTime.enabled) return null;
      return (
        <span className={`${CELL} text-slate-200`}>
          {rival.lastTime > 0 ? formatTime(rival.lastTime, 'mixed') : '—'}
        </span>
      );
    case 'lastTimeDiff':
      if (!config.lastTimeDiff.enabled) return null;
      return (
        <span className={CELL}>
          <DiffCell value={rival.lastTimeDiff} />
        </span>
      );
    case 'bestTime':
      if (!config.bestTime.enabled) return null;
      return (
        <span className={`${CELL} text-slate-200`}>
          {rival.fastestTime > 0 ? formatTime(rival.fastestTime, 'mixed') : '—'}
        </span>
      );
    case 'bestTimeDiff':
      if (!config.bestTimeDiff.enabled) return null;
      return (
        <span className={CELL}>
          <DiffCell value={rival.bestTimeDiff} />
        </span>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Sector row
// ---------------------------------------------------------------------------

const SectorCell = ({ delta }: { delta: SectorDelta }) => {
  const bg =
    delta === '...' || delta === null || delta === 0
      ? ''
      : delta > 0
        ? 'bg-red-900/60'
        : 'bg-green-900/60';

  const text =
    delta === '...'
      ? '...'
      : delta === null
        ? '—'
        : `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;

  const textColor =
    delta === '...' || delta === null || delta === 0
      ? 'text-slate-400'
      : delta > 0
        ? 'text-red-300'
        : 'text-green-300';

  return (
    <span
      className={`flex-1 text-center text-xs tabular-nums px-1 rounded-sm ${bg} ${textColor}`}
    >
      {text}
    </span>
  );
};

interface RivalsSectorRowProps {
  playerCarIdx: number | undefined;
  rivalCarIdx: number;
  displayOrder: RivalColumnId[];
  config: RivalsConfig;
}

const RivalsSectorRow = ({
  playerCarIdx,
  rivalCarIdx,
  displayOrder,
  config,
}: RivalsSectorRowProps) => {
  const { sectorDeltas, lapDelta } = useRivalSectorDeltas(
    playerCarIdx ?? -1,
    rivalCarIdx
  );

  if (!sectorDeltas.length) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 text-xs text-slate-500">
        <span className="w-8 shrink-0" />
        <span className="flex-1 min-w-[20ch] text-slate-600 text-xs">
          waiting for sector data...
        </span>
        {displayOrder.map((colId) => {
          const col = config[colId] as { enabled: boolean };
          if (!col.enabled) return null;
          return <span key={colId} className={CELL} />;
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-0.5">
      <span className="w-8 shrink-0" />
      <div className="flex flex-1 min-w-[20ch] gap-1">
        {sectorDeltas.map((delta, i) => (
          <SectorCell key={i} delta={delta} />
        ))}
      </div>
      {displayOrder.map((colId) => {
        const col = config[colId] as { enabled: boolean };
        if (!col.enabled) return null;
        if (colId === 'lastTimeDiff') {
          return (
            <span key={colId} className={CELL}>
              {lapDelta === '...' ? (
                <span className="text-slate-400">...</span>
              ) : lapDelta === null ? (
                <span className="text-slate-500">—</span>
              ) : (
                <DiffCell value={lapDelta} />
              )}
            </span>
          );
        }
        return <span key={colId} className={CELL} />;
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main row
// ---------------------------------------------------------------------------

export const RivalsRow = memo(
  ({ rival, config, displayOrder, playerCarIdx }: RivalsRowProps) => {
    const order = displayOrder.length > 0 ? displayOrder : RIVAL_COLUMN_IDS;
    const showSectors =
      config.sectors?.enabled && rival !== undefined && playerCarIdx !== undefined;

    if (!rival) {
      return (
        <div className="flex items-center gap-3 px-2 py-1 text-sm">
          <span className="w-8 shrink-0 text-center text-slate-500">—</span>
          <span className="flex-1 min-w-[20ch] text-slate-500">
            No same-class rival
          </span>
          {order.map((colId) => {
            const col = config[colId] as { enabled: boolean };
            if (!col.enabled) return null;
            return (
              <span key={colId} className={`${CELL} text-slate-500`}>
                —
              </span>
            );
          })}
        </div>
      );
    }

    const posLabel = rival.classPosition ? `P${rival.classPosition}` : '—';

    return (
      <>
        <div className="flex items-center gap-3 px-2 py-1 text-sm tabular-nums">
          <span className="w-8 shrink-0 text-center text-amber-300 font-medium">
            {posLabel}
          </span>

          <span className="flex-1 min-w-[20ch] truncate text-white">
            {rival.driver?.name ?? '—'}
          </span>

          {order.map((colId) => (
            <ColCell key={colId} colId={colId} rival={rival} config={config} />
          ))}
        </div>
        {showSectors && (
          <RivalsSectorRow
            playerCarIdx={playerCarIdx}
            rivalCarIdx={rival.carIdx}
            displayOrder={order}
            config={config}
          />
        )}
      </>
    );
  }
);
RivalsRow.displayName = 'RivalsRow';
