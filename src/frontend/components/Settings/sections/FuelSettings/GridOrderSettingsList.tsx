import { SortableList } from '../../../SortableList';
import { FuelWidgetSettings } from '@irdashies/types';
import { SettingNumberRow } from '../../components/SettingNumberRow';
import { DraggableSettingItem } from '../../components/DraggableSettingItem';

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

  return (
    <SortableList
      items={items}
      onReorder={(newItems) => onReorder(newItems.map((i) => i.id))}
      renderItem={(row, sortableProps) => {
        const isEnabled = settings.config[row.configKey] as boolean;

        return (
          <DraggableSettingItem
            key={row.id}
            label={row.label}
            enabled={isEnabled}
            onToggle={(val) => {
              handleConfigChange({ [row.configKey]: val });
            }}
            sortableProps={sortableProps}
          >
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
          </DraggableSettingItem>
        );
      }}
    />
  );
};
