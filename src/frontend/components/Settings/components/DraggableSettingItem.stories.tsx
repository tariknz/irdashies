import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DraggableSettingItem } from './DraggableSettingItem';
import { SortableList, SortableItemProps } from '../../SortableList';

const meta: Meta<typeof DraggableSettingItem> = {
  component: DraggableSettingItem,
  title: 'components/DraggableSettingItem',
};

export default meta;
type Story = StoryObj<typeof meta>;

const noopSortableProps: SortableItemProps = {
  isDragging: false,
  isOver: false,
  dragHandleProps: {
    draggable: true,
    onDragStart: () => undefined,
    onDragEnd: () => undefined,
  },
  itemProps: {
    'data-sortable-id': 'preview',
    ref: () => undefined,
    onDragOver: () => undefined,
    onDragLeave: () => undefined,
    onDrop: () => undefined,
    style: {},
  },
};

export const Default: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(false);
    return (
      <DraggableSettingItem
        label="Driver Name"
        enabled={enabled}
        onToggle={setEnabled}
        sortableProps={noopSortableProps}
      />
    );
  },
};

export const Enabled: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(true);
    return (
      <DraggableSettingItem
        label="Car Number"
        enabled={enabled}
        onToggle={setEnabled}
        sortableProps={noopSortableProps}
      />
    );
  },
};

export const WithSubSettings: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(true);
    return (
      <DraggableSettingItem
        label="Pit Status"
        enabled={enabled}
        onToggle={setEnabled}
        sortableProps={noopSortableProps}
      >
        <div className="flex items-center justify-between pl-8 mt-2">
          <span className="text-sm text-slate-300">Pit Time</span>
          <select className="bg-slate-700 text-white rounded-md px-2 py-1">
            <option>Last pit lap</option>
            <option>Laps since last pit</option>
          </select>
        </div>
      </DraggableSettingItem>
    );
  },
};

export const MultipleItems: Story = {
  render: () => {
    const [items, setItems] = useState([
      { id: 'position', label: 'Position', enabled: true },
      { id: 'carNumber', label: 'Car Number', enabled: false },
      { id: 'driverName', label: 'Driver Name', enabled: true },
      { id: 'teamName', label: 'Team Name', enabled: false },
    ]);

    return (
      <SortableList
        items={items}
        onReorder={setItems}
        renderItem={(item, sortableProps) => (
          <DraggableSettingItem
            key={item.id}
            label={item.label}
            enabled={item.enabled}
            onToggle={(enabled) => {
              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, enabled } : i))
              );
            }}
            sortableProps={sortableProps}
          />
        )}
      />
    );
  },
};
