import { memo, useLayoutEffect, useRef } from 'react';
import { formatTime } from '@irdashies/utils/time';
import { RivalsConfig, TimeFormat } from '@irdashies/types';
import {
  useGeneralSettings,
  useRivalSectorDeltas,
  useSectorTimingStore,
  useTelemetryStore,
  type SectorDelta,
} from '@irdashies/context';
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

interface CompactSizes {
  rowPy: string;
  rowGap: string;
  rowPx: string;
  fontSize: string;
  headerFontSize: string;
  cellW: string;
  posW: string;
  sectorPy: string;
}

export const getCompactSizes = (compactMode?: string): CompactSizes => {
  if (compactMode === 'ultra')
    return { rowPy: 'py-0', rowGap: 'gap-1', rowPx: '', fontSize: 'text-xs', headerFontSize: 'text-[9px]', cellW: '', posW: '', sectorPy: '' };
  if (compactMode === 'compact')
    return { rowPy: 'py-0.5', rowGap: 'gap-1', rowPx: 'px-1', fontSize: 'text-sm', headerFontSize: 'text-[10px]', cellW: 'w-10', posW: 'w-6', sectorPy: 'py-0' };
  return { rowPy: 'py-1', rowGap: 'gap-3', rowPx: 'px-2', fontSize: 'text-sm', headerFontSize: 'text-xs', cellW: 'w-16', posW: 'w-8', sectorPy: 'py-0.5' };
};

const cellClass = (w: string) => `${w} text-right shrink-0 tabular-nums`;

const DiffCell = ({
  value,
  timeFormat,
}: {
  value: number | undefined;
  timeFormat: TimeFormat;
}) => {
  if (value === undefined) return <span className="text-slate-500">—</span>;
  const sign = value > 0 ? '+' : '';
  const color =
    value < 0 ? 'text-red-400' : value > 0 ? 'text-green-400' : 'text-slate-300';
  return (
    <span className={color}>
      {sign}
      {formatTime(Math.abs(value), timeFormat)}
    </span>
  );
};

const ColCell = ({
  colId,
  rival,
  config,
  cellW,
}: {
  colId: RivalColumnId;
  rival: RivalEntry;
  config: RivalsConfig;
  cellW: string;
}) => {
  const timeFormat: TimeFormat = config.timeFormat ?? 'seconds-full';
  const CELL = cellClass(cellW);
  switch (colId) {
    case 'gap': {
      if (!config.gap.enabled) return null;
      const gapAbs = Math.abs(rival.delta ?? 0);
      const gapSign = rival.relativePct > 0 ? '+' : '-';
      return (
        <span className={`${CELL} text-slate-200`}>
          {gapSign}
          {formatTime(gapAbs, timeFormat)}
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
          <DiffCell value={rival.lastTimeDiff} timeFormat={timeFormat} />
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
          <DiffCell value={rival.bestTimeDiff} timeFormat={timeFormat} />
        </span>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Sector row
// ---------------------------------------------------------------------------

const RivalSectorProgressIndicator = ({
  sectorStart,
  sectorEnd,
  carIdx,
}: {
  sectorStart: number;
  sectorEnd: number;
  carIdx: number;
}) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const apply = () => {
      const lapDistPct =
        useTelemetryStore.getState().telemetry?.CarIdxLapDistPct?.value?.[carIdx] ?? 0;
      const span = sectorEnd - sectorStart;
      const progress =
        span > 0
          ? Math.max(0, Math.min(1, (lapDistPct - sectorStart) / span))
          : 0;
      const w = `${progress * 100}%`;
      if (fillRef.current) fillRef.current.style.width = w;
      if (topBarRef.current) topBarRef.current.style.width = w;
      if (bottomBarRef.current) bottomBarRef.current.style.width = w;
    };
    apply();
    return useTelemetryStore.subscribe(apply);
  }, [sectorStart, sectorEnd, carIdx]);

  return (
    <>
      <div
        ref={fillRef}
        className="absolute top-0 left-0 bottom-0 w-0"
        style={{ backgroundColor: 'rgba(56, 189, 248, 0.4)' }}
      />
      <div ref={topBarRef} className="absolute top-0 left-0 h-0.5 w-0 bg-sky-400" />
      <div
        ref={bottomBarRef}
        className="absolute bottom-0 left-0 h-0.5 w-0 bg-sky-400"
      />
    </>
  );
};

const SectorCell = ({
  delta,
  sectorStart,
  sectorEnd,
  rivalCarIdx,
  timeFormat,
}: {
  delta: SectorDelta;
  sectorStart: number;
  sectorEnd: number;
  rivalCarIdx: number;
  timeFormat: TimeFormat;
}) => {
  const stale = typeof delta === 'object' && delta !== null;
  const val = stale ? delta.value : typeof delta === 'number' ? delta : null;
  const showAnimation = delta === '...' || stale;

  const bg =
    val === null || val === 0
      ? ''
      : val > 0
        ? 'bg-red-900/60'
        : 'bg-green-900/60';

  const text =
    delta === '...'
      ? '--'
      : val === null
        ? '—'
        : `${val > 0 ? '+' : ''}${formatTime(Math.abs(val), timeFormat)}`;

  const textColor =
    val === null || val === 0
      ? 'text-slate-400'
      : val > 0
        ? 'text-red-300'
        : 'text-green-300';

  return (
    <div
      className={`relative flex-1 min-w-0 flex items-center justify-center text-xs tabular-nums px-1 py-0.5 rounded-sm overflow-hidden ${bg} ${textColor}`}
    >
      {showAnimation && (
        <RivalSectorProgressIndicator
          sectorStart={sectorStart}
          sectorEnd={sectorEnd}
          carIdx={rivalCarIdx}
        />
      )}
      <span className={`relative${stale ? ' italic' : ''}`}>{text}</span>
    </div>
  );
};

interface RivalsSectorRowProps {
  playerCarIdx: number | undefined;
  rivalCarIdx: number;
  showHeader: boolean;
  timeFormat: TimeFormat;
  sectorPy: string;
  rowPx: string;
  posW: string;
}

const RivalsSectorRow = ({ playerCarIdx, rivalCarIdx, showHeader, timeFormat, sectorPy, rowPx, posW }: RivalsSectorRowProps) => {
  const sectors = useSectorTimingStore((s) => s.sectors);
  const { sectorDeltas } = useRivalSectorDeltas(playerCarIdx ?? -1, rivalCarIdx);

  if (!sectors.length) return null;

  return (
    <div className={`flex flex-col gap-0.5 ${rowPx} ${sectorPy}`}>
      {showHeader && (
        <div className="flex items-center">
          <span className={`${posW} shrink-0`} />
          {sectors.map((s) => (
            <span
              key={s.SectorNum}
              className="flex-1 min-w-0 text-center text-xs font-semibold text-slate-400 leading-none"
            >
              S{s.SectorNum + 1}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-0.5">
        <span className={`${posW} shrink-0`} />
        {sectors.map((s, i) => (
          <SectorCell
            key={s.SectorNum}
            delta={sectorDeltas[i] ?? null}
            sectorStart={s.SectorStartPct}
            sectorEnd={sectors[i + 1]?.SectorStartPct ?? 1}
            rivalCarIdx={rivalCarIdx}
            timeFormat={timeFormat}
          />
        ))}
      </div>
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
    const compactMode = useGeneralSettings()?.compactMode;
    const { rowPy, rowGap, rowPx, fontSize, cellW, posW, sectorPy } = getCompactSizes(compactMode);

    if (!rival) {
      return (
        <div className={`flex items-center ${rowGap} ${rowPx} ${rowPy} ${fontSize}`}>
          <span className={`${posW} shrink-0 text-center text-slate-500`}>—</span>
          <span className="flex-1 min-w-0 text-slate-500">
            No same-class rival
          </span>
          {order.map((colId) => {
            const col = config[colId] as { enabled: boolean };
            if (!col.enabled) return null;
            return (
              <span key={colId} className={`${cellClass(cellW)} text-slate-500`}>
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
        <div className={`flex items-center ${rowGap} ${rowPx} ${rowPy} ${fontSize} tabular-nums`}>
          <span className={`${posW} shrink-0 text-center text-amber-300 font-medium`}>
            {posLabel}
          </span>

          <span className="flex-1 min-w-0 truncate text-white">
            {rival.driver?.name ?? '—'}
          </span>

          {order.map((colId) => (
            <ColCell key={colId} colId={colId} rival={rival} config={config} cellW={cellW} />
          ))}
        </div>
        {showSectors && (
          <RivalsSectorRow
            playerCarIdx={playerCarIdx}
            rivalCarIdx={rival.carIdx}
            showHeader={config.showHeader?.enabled ?? false}
            timeFormat={config.timeFormat ?? 'seconds-full'}
            sectorPy={sectorPy}
            rowPx={rowPx}
            posW={posW}
          />
        )}
      </>
    );
  }
);
RivalsRow.displayName = 'RivalsRow';
