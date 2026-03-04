import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useSortableList } from '../../../SortableList';
import { FuelWidgetSettings } from '../../types';
import { SettingNumberRow } from '../../components/SettingNumberRow';

interface SortableRow {
  id: string;
  label: string;
  configKey: keyof FuelWidgetSettings['config'];
}

export const getSortableRows = (avgLapsCount: number): SortableRow[] => [
  { id: 'curr', label: 'Current Lap', configKey: 'showCurrentLap' },
  {
    id: 'avg',
    label: `Average (${avgLapsCount} Lap)`,
    configKey: 'show3LapAvg',
  },
  { id: 'max', label: 'Max Consumption', configKey: 'showMax' },
  { id: 'last', label: 'Last Lap', configKey: 'showLastLap' },
  { id: 'min', label: 'Min Consumption', configKey: 'showMin' },
  { id: 'qual', label: 'Qualify Max', configKey: 'showQualifyConsumption' },
];

export const GridOrderSettingsList = ({
  itemsOrder,
  onReorder,
  settings,
  handleConfigChange,
}: {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: FuelWidgetSettings;
  handleConfigChange: (changes: Partial<FuelWidgetSettings['config']>) => void;
}) => {
  const rows = getSortableRows(settings.config.avgLapsCount || 3);
  const validIds = rows.map((r: SortableRow) => r.id);
  const items = itemsOrder
    .filter((id) => validIds.includes(id))
    .map((id) => {
      const row = rows.find((r: SortableRow) => r.id === id);
      return row ? { ...row } : null;
    })
    .filter((r): r is SortableRow => r !== null);

  rows.forEach((def: SortableRow) => {
    if (!items.find((i) => i.id === def.id)) items.push(def);
  });

  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder: (newItems) => onReorder(newItems.map((i) => i.id)),
    getItemId: (item) => item.id,
  });

  return (
    <div className="space-y-2 mt-2">
      {displayItems.map((row) => {
        const { dragHandleProps, itemProps } = getItemProps(row);
        const isEnabled = settings.config[row.configKey] as boolean;

        return (
          <div key={row.id} {...itemProps}>
            <div className="flex flex-col bg-slate-800/50 p-1.5 rounded border border-transparent hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    {...dragHandleProps}
                    className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded text-slate-400"
                  >
                    <DotsSixVerticalIcon size={14} />
                  </div>
                  <span className="text-sm text-slate-300 font-medium">{row.label}</span>
                </div>
                <ToggleSwitch
                  enabled={isEnabled}
                  onToggle={(val) => {
                    handleConfigChange({ [row.configKey]: val });
                  }}
                />
              </div>

              {row.id === 'avg' && isEnabled && (
                <div className="pl-12 pt-4">
                  <SettingNumberRow
                    title="Average Laps"                 
                    value={settings.config.avgLapsCount ?? 3}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(v) => handleConfigChange({ avgLapsCount: v })}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
