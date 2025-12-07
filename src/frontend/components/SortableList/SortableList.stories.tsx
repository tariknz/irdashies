import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SortableList } from './SortableList';
import { useSortableList } from './useSortableList';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';

const meta = {
  component: SortableList,
} satisfies Meta<typeof SortableList>;

export default meta;
type Story = StoryObj<typeof SortableList>;

interface SettingItem {
  id: string;
  label: string;
  enabled: boolean;
}

const initialItems: SettingItem[] = [
  { id: 'position', label: 'Position', enabled: true },
  { id: 'carNumber', label: 'Car Number', enabled: true },
  { id: 'driverName', label: 'Driver Name', enabled: true },
  { id: 'delta', label: 'Delta', enabled: false },
  { id: 'fastestTime', label: 'Best Time', enabled: true },
];

const SortableListDemo = () => {
  const [items, setItems] = useState(initialItems);

  return (
    <div className="p-4 bg-slate-800 rounded-lg w-80">
      <h3 className="text-lg font-medium text-slate-200 mb-4">
        Drag to Reorder
      </h3>
      <SortableList
        items={items}
        onReorder={setItems}
        className="space-y-2"
        renderItem={(item, { dragHandleProps, itemProps }) => (
          <div
            key={item.id}
            {...itemProps}
            className="flex items-center gap-2 p-2 bg-slate-700 rounded"
          >
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-600 rounded"
            >
              <DotsSixVerticalIcon className="text-slate-400" size={16} />
            </div>
            <span className="text-slate-200 text-sm flex-1">{item.label}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                item.enabled
                  ? 'bg-green-600 text-green-100'
                  : 'bg-slate-600 text-slate-400'
              }`}
            >
              {item.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        )}
      />
      <div className="mt-4 text-xs text-slate-400">
        Current order: {items.map((i) => i.id).join(', ')}
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <SortableListDemo />,
};

const HookOnlyDemo = () => {
  const [items, setItems] = useState(initialItems);
  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder: setItems,
    getItemId: (item) => item.id,
  });

  return (
    <div className="p-4 bg-slate-800 rounded-lg w-80">
      <h3 className="text-lg font-medium text-slate-200 mb-4">
        Using Hook Directly
      </h3>
      <div className="space-y-2">
        {displayItems.map((item) => {
          const { dragHandleProps, itemProps } = getItemProps(item);
          return (
            <div
              key={item.id}
              {...itemProps}
              className="flex items-center gap-2 p-2 bg-slate-700 rounded"
            >
              <div
                {...dragHandleProps}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-600 rounded"
              >
                <DotsSixVerticalIcon className="text-slate-400" size={16} />
              </div>
              <span className="text-slate-200 text-sm">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const UsingHookDirectly: Story = {
  render: () => <HookOnlyDemo />,
};

const StringArrayDemo = () => {
  const [items, setItems] = useState([
    'sessionName',
    'timeRemaining',
    'incidentCount',
    'brakeBias',
  ]);

  const wrappedItems = items.map((id) => ({ id }));

  return (
    <div className="p-4 bg-slate-800 rounded-lg w-80">
      <h3 className="text-lg font-medium text-slate-200 mb-4">
        String Array (like displayOrder)
      </h3>
      <SortableList
        items={wrappedItems}
        onReorder={(newItems) => setItems(newItems.map((i) => i.id))}
        className="space-y-2"
        renderItem={(item, { dragHandleProps, itemProps }) => (
          <div
            key={item.id}
            {...itemProps}
            className="flex items-center gap-2 p-2 bg-slate-700 rounded"
          >
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-600 rounded"
            >
              <DotsSixVerticalIcon className="text-slate-400" size={16} />
            </div>
            <span className="text-slate-200 text-sm">{item.id}</span>
          </div>
        )}
      />
    </div>
  );
};

export const StringArrayItems: Story = {
  render: () => <StringArrayDemo />,
};
