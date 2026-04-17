import { useMemo, useCallback } from 'react';
import { useSortableList } from '../../../SortableList';
import { DraggableSettingItem } from '../../components/DraggableSettingItem';

export const ROTATE_COLORS = [
  '#fbbf24', // amber-400
  '#60a5fa', // blue-400
  '#4ade80', // green-400
  '#f87171', // red-400
  '#c084fc', // purple-400
  '#22d3ee', // cyan-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#818cf8', // indigo-400
  '#fb7185', // rose-400
];

export interface SharedSortableSetting {
  id: string;
  label: string;
  configKey: string;
  hasSubSetting?: boolean;
  canRotate?: boolean;
}

interface DisplaySettingsListProps {
  itemsOrder: string[];
  sortableSettings: SharedSortableSetting[];
  rotationGroups: { columns: string[] }[];
  getConfigValue: (configKey: string) => {
    enabled: boolean;
    [key: string]: unknown;
  };
  onConfigChange: (changes: Record<string, unknown>) => void;
  renderItemChildren?: (
    item: SharedSortableSetting,
    configValue: { enabled: boolean; [key: string]: unknown }
  ) => React.ReactNode;
}

export const DisplaySettingsList = ({
  itemsOrder,
  sortableSettings,
  rotationGroups,
  getConfigValue,
  onConfigChange,
  renderItemChildren,
}: DisplaySettingsListProps) => {
  const items = useMemo(() => {
    return itemsOrder
      .map((id) => {
        const setting = sortableSettings.find((s) => s.id === id);
        return setting ? { ...setting } : null;
      })
      .filter((s): s is SharedSortableSetting => s !== null);
  }, [itemsOrder, sortableSettings]);

  const getCleanGroups = useCallback(
    (order: string[], currentGroups: { columns: string[] }[]) => {
      const newGroups: { columns: string[] }[] = [];
      currentGroups.forEach((group) => {
        const indices = group.columns
          .map((id) => order.indexOf(id))
          .filter((idx) => idx !== -1)
          .sort((a, b) => a - b);

        if (indices.length < 2) return;

        let currentBlock: string[] = [order[indices[0]]];
        for (let i = 1; i < indices.length; i++) {
          if (indices[i] === indices[i - 1] + 1) {
            currentBlock.push(order[indices[i]]);
          } else {
            if (currentBlock.length >= 2)
              newGroups.push({ columns: currentBlock });
            currentBlock = [order[indices[i]]];
          }
        }
        if (currentBlock.length >= 2) newGroups.push({ columns: currentBlock });
      });
      return newGroups;
    },
    []
  );

  const { getItemProps, displayItems } = useSortableList<SharedSortableSetting>(
    {
      items,
      onReorder: (newItems: SharedSortableSetting[]) => {
        const newOrder = newItems.map((i) => i.id);
        const cleanGroups = getCleanGroups(newOrder, rotationGroups);
        onConfigChange({ displayOrder: newOrder, rotationGroups: cleanGroups });
      },
      getItemId: (item: SharedSortableSetting) => item.id,
    }
  );

  const groupMetadata = useMemo(() => {
    const metadata: Record<string, { isInGroup: boolean; groupIdx: number }> =
      {};
    rotationGroups.forEach((group, idx) => {
      (group.columns || []).forEach((colId) => {
        metadata[colId] = { isInGroup: true, groupIdx: idx };
      });
    });
    return metadata;
  }, [rotationGroups]);

  const typedDisplayItems = displayItems as SharedSortableSetting[];

  const handleGroupAction = (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = typedDisplayItems.findIndex((i) => i.id === itemId);
    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= typedDisplayItems.length) return;

    const targetId = typedDisplayItems[targetIndex].id;
    const workingGroups = rotationGroups.map((g) => ({
      ...g,
      columns: g.columns.filter((id) => id !== itemId),
    }));

    const groupOfTarget = workingGroups.find((g) =>
      g.columns.includes(targetId)
    );

    if (groupOfTarget) {
      const updatedColumns = Array.from(
        new Set([...groupOfTarget.columns, itemId])
      );
      const idx = workingGroups.indexOf(groupOfTarget);
      workingGroups[idx] = { ...groupOfTarget, columns: updatedColumns };
    } else {
      workingGroups.push({ columns: [itemId, targetId] });
    }

    const finalGroups = getCleanGroups(
      typedDisplayItems.map((i) => i.id),
      workingGroups
    );
    onConfigChange({ rotationGroups: finalGroups });
  };

  const handleUngroup = (itemId: string) => {
    const workingGroups = rotationGroups.map((g) => ({
      ...g,
      columns: g.columns.filter((id) => id !== itemId),
    }));
    const finalGroups = getCleanGroups(
      typedDisplayItems.map((i) => i.id),
      workingGroups
    );
    onConfigChange({ rotationGroups: finalGroups });
  };

  return (
    <div className="space-y-3">
      {typedDisplayItems.map((item, index) => {
        const configValue = getConfigValue(item.configKey);
        const isEnabled = configValue.enabled;
        const meta = groupMetadata[item.id];
        const sortableProps = getItemProps(item);

        const prevItem = index > 0 ? typedDisplayItems[index - 1] : null;
        const nextItem =
          index < typedDisplayItems.length - 1
            ? typedDisplayItems[index + 1]
            : null;

        const isSameGroupAsPrev =
          meta?.isInGroup &&
          groupMetadata[prevItem?.id || '']?.isInGroup &&
          meta.groupIdx === groupMetadata[prevItem?.id || '']?.groupIdx;
        const isSameGroupAsNext =
          meta?.isInGroup &&
          groupMetadata[nextItem?.id || '']?.isInGroup &&
          meta.groupIdx === groupMetadata[nextItem?.id || '']?.groupIdx;

        const canGroupUp =
          !!item.canRotate && !!prevItem?.canRotate && !isSameGroupAsPrev;
        const canGroupDown =
          !!item.canRotate && !!nextItem?.canRotate && !isSameGroupAsNext;

        return (
          <DraggableSettingItem
            key={item.id}
            label={item.label}
            enabled={isEnabled}
            canRotate={item.canRotate}
            isInGroup={!!meta?.isInGroup}
            groupColor={
              meta?.isInGroup
                ? ROTATE_COLORS[meta.groupIdx % ROTATE_COLORS.length]
                : undefined
            }
            canGroupUp={canGroupUp}
            canGroupDown={canGroupDown}
            onGroupUp={() => handleGroupAction(item.id, 'up')}
            onGroupDown={() => handleGroupAction(item.id, 'down')}
            onUngroup={() => handleUngroup(item.id)}
            sortableProps={sortableProps}
            onToggle={(enabled) => {
              onConfigChange({ [item.configKey]: { ...configValue, enabled } });
            }}
          >
            {renderItemChildren?.(item, configValue)}
          </DraggableSettingItem>
        );
      })}
    </div>
  );
};
