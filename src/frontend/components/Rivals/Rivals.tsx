import {
  useDrivingState,
  useSessionVisibility,
  useFocusCarIdx,
  useRivalSectorStoreUpdater,
} from '@irdashies/context';
import { useRivalsData } from './hooks/useRivalsData';
import { useRivalsSettings } from './hooks/useRivalsSettings';
import {
  RivalsRow,
  RIVAL_COLUMN_IDS,
  RIVAL_COLUMN_META,
  RivalColumnId,
} from './RivalsRow';
import { getWidgetDefaultConfig } from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('rivals');

export const Rivals = () => {
  const settings = useRivalsSettings();
  const config = settings ?? defaultConfig;
  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(config.sessionVisibility);
  const { ahead, behind } = useRivalsData();
  const playerCarIdx = useFocusCarIdx();
  useRivalSectorStoreUpdater(config.sectors?.enabled ?? false);

  if (!isSessionVisible) return null;
  if (config.showOnlyWhenOnTrack && !isDriving) return null;

  const rawOrder = config.displayOrder ?? RIVAL_COLUMN_IDS;
  const displayOrder = rawOrder.filter((id): id is RivalColumnId =>
    RIVAL_COLUMN_IDS.includes(id as RivalColumnId)
  );

  return (
    <div
      className="w-full h-full rounded-md overflow-hidden bg-slate-800/(--bg-opacity) flex flex-col justify-center"
      style={{
        ['--bg-opacity' as string]: `${config.background.opacity}%`,
      }}
    >
      {config.showHeader?.enabled && (
        <div className="flex items-center gap-3 px-2 py-0.5 text-xs text-slate-400 uppercase tracking-wider border-b border-slate-600/50">
          <span className="w-8 shrink-0 text-center">Pos</span>
          <span className="flex-1 min-w-[20ch]">Driver</span>
          {displayOrder.map((colId) => {
            const col = config[colId as keyof typeof config] as
              | { enabled: boolean }
              | undefined;
            if (!col?.enabled) return null;
            return (
              <span key={colId} className="w-16 text-right shrink-0">
                {RIVAL_COLUMN_META[colId].header}
              </span>
            );
          })}
        </div>
      )}
      <RivalsRow
        rival={ahead}
        config={config}
        displayOrder={displayOrder}
        playerCarIdx={playerCarIdx}
      />
      <div className="mx-2 border-t border-slate-600/50" />
      <RivalsRow
        rival={behind}
        config={config}
        displayOrder={displayOrder}
        playerCarIdx={playerCarIdx}
      />
    </div>
  );
};
