import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import type { StandingsBadgeFormat } from '@irdashies/types';
import { ToggleSwitch } from './ToggleSwitch';
import { useSortableList } from '../../SortableList';
import { SESSION_BAR_ITEM_LABELS } from '../sessionBarConstants';
import { BadgeFormatPreview } from './BadgeFormatPreview';

export interface SessionBarItemConfig {
  enabled: boolean;
  unit?: 'Metric' | 'Imperial';
  mode?: 'Remaining' | 'Elapsed';
  totalFormat?: 'hh:mm' | 'minimal';
  labelStyle?: 'none' | 'short' | 'minimal';
  speedPosition?: 'left' | 'right';
  badgeFormat?: StandingsBadgeFormat;
}

interface SessionBarItemsListProps {
  items: string[];
  onReorder: (newOrder: string[]) => void;
  getItemConfig: (id: string) => SessionBarItemConfig | undefined;
  updateItemConfig: (id: string, config: Partial<SessionBarItemConfig>) => void;
}

export const SessionBarItemsList = ({
  items,
  onReorder,
  getItemConfig,
  updateItemConfig,
}: SessionBarItemsListProps) => {
  const wrappedItems = items.map((id) => ({ id }));

  const { getItemProps, displayItems } = useSortableList({
    items: wrappedItems,
    onReorder: (newItems) => onReorder(newItems.map((i) => i.id)),
    getItemId: (item) => item.id,
  });

  return (
    <div className="space-y-3 pl-4">
      {displayItems.map((item) => {
        const { dragHandleProps, itemProps } = getItemProps(item);
        const itemConfig = getItemConfig(item.id);

        if (!itemConfig) {
          return null;
        }

        return (
          <div key={item.id} {...itemProps}>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2 flex-1">
                <div
                  {...dragHandleProps}
                  className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded"
                >
                  <DotsSixVerticalIcon size={16} className="text-slate-400" />
                </div>
                <span className="text-sm text-slate-300">
                  {SESSION_BAR_ITEM_LABELS[item.id]}
                </span>
              </div>
              <ToggleSwitch
                enabled={itemConfig.enabled}
                onToggle={(enabled) => updateItemConfig(item.id, { enabled })}
              />
            </div>

            {(item.id === 'airTemperature' || item.id === 'trackTemperature') &&
              itemConfig.enabled && (
                <div className="flex items-center justify-between pl-4 mt-2">
                  <span></span>
                  <select
                    value={itemConfig.unit ?? 'Metric'}
                    onChange={(e) =>
                      updateItemConfig(item.id, {
                        unit: e.target.value as 'Metric' | 'Imperial',
                      })
                    }
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="Metric">°C</option>
                    <option value="Imperial">°F</option>
                  </select>
                </div>
              )}

            {item.id === 'wind' && itemConfig.enabled && (
              <div className="flex items-center justify-end gap-2 pl-4 mt-2">
                {(['left', 'right'] as const).map((pos) => {
                  const currentPos = itemConfig.speedPosition ?? 'right';
                  const arrow = (
                    <svg
                      viewBox="50 80 650 720"
                      className="w-3 h-3.5 fill-current shrink-0"
                      style={{ rotate: '-14deg' }}
                    >
                      <path
                        fillRule="nonzero"
                        d="m373.75 91.496c-0.95-1.132-74.87 153.23-164.19 343.02-160.8 341.68-162.27 345.16-156.49 350.27 3.203 2.83 6.954 4.79 8.319 4.34 1.365-0.46 71.171-73.88 155.14-163.1 83.97-89.22 153.66-162.83 154.87-163.56 1.2-0.72 71.42 72.34 156.04 162.29s155.21 163.82 156.95 164.19 5.57-1.19 8.5-3.44c5.04-3.86-3.75-23.46-156.04-348-88.77-189.18-162.15-344.88-163.1-346.01z"
                      />
                    </svg>
                  );
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        updateItemConfig(item.id, { speedPosition: pos })
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-white ${currentPos === pos ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                      {pos === 'left' ? (
                        <>
                          <span>7</span>
                          {arrow}
                        </>
                      ) : (
                        <>
                          {arrow}
                          <span>7</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {item.id === 'driverBadge' && itemConfig.enabled && (
              <div className="flex flex-wrap gap-3 justify-end pl-4 mt-2">
                {(
                  [
                    'license-color-fullrating-combo',
                    'fullrating-color-no-license',
                    'rating-color-no-license',
                    'license-color-fullrating-bw',
                    'license-color-rating-bw',
                    'rating-only-color-rating-bw',
                    'license-color-rating-bw-no-license',
                    'license-bw-rating-bw',
                    'rating-only-bw-rating-bw',
                    'license-bw-rating-bw-no-license',
                    'rating-bw-no-license',
                    'fullrating-bw-no-license',
                  ] as const
                ).map((format) => (
                  <BadgeFormatPreview
                    key={format}
                    format={format}
                    selected={
                      (itemConfig.badgeFormat ?? 'license-color-rating-bw') ===
                      format
                    }
                    onClick={() =>
                      updateItemConfig(item.id, { badgeFormat: format })
                    }
                  />
                ))}
              </div>
            )}

            {item.id === 'sessionLaps' && itemConfig.enabled && (
              <div className="flex items-center justify-end gap-3 pl-4 mt-2">
                <span></span>
                <select
                  value={itemConfig.mode ?? 'Elapsed'}
                  onChange={(e) =>
                    updateItemConfig(item.id, {
                      mode: e.target.value as 'Elapsed' | 'Remaining',
                    })
                  }
                  className="bg-slate-700 text-white rounded-md px-2 py-1"
                >
                  <option value="Elapsed">Elapsed</option>
                  <option value="Remaining">Remaining</option>
                </select>
              </div>
            )}

            {item.id === 'sessionTime' && itemConfig.enabled && (
              <div className="flex items-center justify-end gap-3 pl-4 mt-2">
                <span></span>
                <select
                  value={itemConfig.mode ?? 'Remaining'}
                  onChange={(e) =>
                    updateItemConfig(item.id, {
                      mode: e.target.value as 'Remaining' | 'Elapsed',
                    })
                  }
                  className="bg-slate-700 text-white rounded-md px-2 py-1"
                >
                  <option value="Remaining">Remaining</option>
                  <option value="Elapsed">Elapsed</option>
                </select>
                <select
                  value={itemConfig.totalFormat ?? 'minimal'}
                  onChange={(e) =>
                    updateItemConfig(item.id, {
                      totalFormat: e.target.value as 'hh:mm' | 'minimal',
                    })
                  }
                  className="bg-slate-700 text-white rounded-md px-2 py-1"
                >
                  <option value="minimal">2:34</option>
                  <option value="hh:mm">00:12:34</option>
                </select>
                <select
                  value={itemConfig.labelStyle ?? 'minimal'}
                  onChange={(e) =>
                    updateItemConfig(item.id, {
                      labelStyle: e.target.value as
                        | 'none'
                        | 'short'
                        | 'minimal',
                    })
                  }
                  className="bg-slate-700 text-white rounded-md px-2 py-1"
                >
                  <option value="minimal">Minimal Labels</option>
                  <option value="short">Short Labels</option>
                  <option value="none">Hide Labels</option>
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
