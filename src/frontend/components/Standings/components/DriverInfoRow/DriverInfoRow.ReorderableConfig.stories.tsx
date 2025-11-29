import { StoryObj } from '@storybook/react-vite';
import { DriverInfoRow } from './DriverInfoRow';
import { DriverRatingBadge } from '../DriverRatingBadge/DriverRatingBadge';
import { RatingChange } from '../RatingChange/RatingChange';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useCurrentSessionType } from '@irdashies/context';
import type { RelativeWidgetSettings } from '../../../Settings/types';
import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import type { Meta } from '@storybook/react-vite';
import type { DriverInfoRow as DriverInfoRowType } from './DriverInfoRow';
import type { ComponentType } from 'react';

const meta = {
  component: DriverInfoRow,
  decorators: [
    (Story: ComponentType) => (
      <table className="w-full">
        <tbody>
          <Story />
        </tbody>
      </table>
    ),
  ],
} satisfies Meta<typeof DriverInfoRow>;

export default meta;

type Story = StoryObj<typeof DriverInfoRowType>;

const sortableSettings = [
  { id: 'position', label: 'Position' },
  { id: 'carNumber', label: 'Car Number' },
  { id: 'countryFlags', label: 'Country Flags' },
  { id: 'driverName', label: 'Driver Name' },
  { id: 'pitStatus', label: 'Pit Status' },
  { id: 'carManufacturer', label: 'Car Manufacturer' },
  { id: 'badge', label: 'Driver Badge' },
  { id: 'iratingChange', label: 'iRating Change' },
  { id: 'delta', label: 'Delta' },
  { id: 'fastestTime', label: 'Best Time' },
  { id: 'lastTime', label: 'Last Time' },
  { id: 'compound', label: 'Tire Compound' },
];

const SortableItem = ({ id, label }: { id: string; label: string }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-slate-700 rounded mb-1 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <DotsSixVerticalIcon className="text-slate-400" size={16} />
      <span className="text-slate-200 text-sm">{label}</span>
    </div>
  );
};

const RelativeWithReorderableConfig = () => {
  const getRandomRating = () =>
    Math.floor(Math.random() * (1300 - 700 + 1)) + 700;
  const getRandomLicense = () => {
    const licenses = ['C', 'B', 'A'];
    const license = licenses[Math.floor(Math.random() * licenses.length)];
    const rating = (Math.random() * (4.5 - 1.5) + 1.5).toFixed(2);
    return `${license} ${rating}`;
  };

  const names = [
    'Alice',
    'Bob',
    'Charlie',
    'David',
    'Eve',
    'Frank',
    'Grace',
    'Hank',
    'Ivy',
    'Jack',
  ];
  const getRandomName = () => names[Math.floor(Math.random() * names.length)];
  const getRandomSurname = () => {
    const surnames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
    ];
    return surnames[Math.floor(Math.random() * surnames.length)];
  };

  const getRandomMiddleName = () => {
    const middleNames = [
      'James',
      'Marie',
      'Lee',
      'Ann',
      'Grace',
      'John',
      'Michael',
      'Elizabeth',
      'David',
      'Rose',
    ];
    return middleNames[Math.floor(Math.random() * middleNames.length)];
  };

  const getRandomFullName = () => {
    const hasMiddleName = Math.random() > 0.5;
    const firstName = getRandomName();
    const surname = getRandomSurname();
    if (hasMiddleName) {
      const middleName = getRandomMiddleName();
      return `${firstName} ${middleName} ${surname}`;
    }
    return `${firstName} ${surname}`;
  };

  const standings = [
    {
      carIdx: 1,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 223,
      },
      isPlayer: false,
      delta: 12,
      classPosition: 1,
      hasFastestTime: false,
      lastTime: 112.225,
      fastestTime: 111.111,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: undefined,
      tireCompound: 0,
      lastPitLap: 0,
      currentSessionType: useCurrentSessionType(),
      carId: 122,
      iratingChange: 15,
    },
    {
      carIdx: 2,
      carClass: { color: 0xffda59 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 222,
      },
      isPlayer: false,
      delta: 2.7,
      classPosition: 9,
      hasFastestTime: false,
      lastTime: 112.225,
      fastestTime: 111.111,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'ahead',
      tireCompound: 1,
      lastPitLap: 0,
      currentSessionType: useCurrentSessionType(),
      carId: 122,
      iratingChange: -8,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 3,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 77,
      },
      isPlayer: false,
      delta: 0.7,
      classPosition: 2,
      hasFastestTime: false,
      lastTime: 112.225,
      fastestTime: 111.111,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'same',
      tireCompound: 1,
      lastPitLap: 0,
      currentSessionType: useCurrentSessionType(),
      carId: 122,
      iratingChange: 0,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 4,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '23',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 71,
      },
      isPlayer: true,
      delta: 0,
      classPosition: 3,
      hasFastestTime: false,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'same',
      tireCompound: 1,
      lastPitLap: 15,
      currentSessionType: useCurrentSessionType(),
      carId: 122,
      iratingChange: 23,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 5,
      carClass: { color: 0xae6bff },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 101,
      },
      isPlayer: false,
      delta: -0.3,
      classPosition: 12,
      hasFastestTime: false,
      onPitRoad: false,
      onTrack: true,
      radioActive: false,
      lappedState: 'behind',
      tireCompound: 1,
      lastPitLap: 0,
      currentSessionType: useCurrentSessionType(),
      carId: 122,
      iratingChange: -42,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 6,
      carClass: { color: 0xff5888 },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 198,
      },
      isPlayer: false,
      delta: -3.9,
      classPosition: 4,
      hasFastestTime: false,
      onPitRoad: true,
      onTrack: true,
      radioActive: false,
      lappedState: 'same',
      tireCompound: 1,
      lastPitLap: 0,
      currentSessionType: useCurrentSessionType(),
      carId: 122,
      iratingChange: 5,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
    {
      carIdx: 7,
      carClass: { color: 0xae6bff },
      driver: {
        carNum: '999',
        name: getRandomFullName(),
        license: getRandomLicense(),
        rating: getRandomRating(),
        flairId: 39,
      },
      isPlayer: false,
      delta: -33.2,
      classPosition: 7,
      hasFastestTime: false,
      onPitRoad: false,
      onTrack: true,
      radioActive: true,
      tireCompound: 1,
      lastPitLap: 5,
      currentSessionType: useCurrentSessionType(),
      carId: 122,
      iratingChange: -15,
      dnf: false,
      repair: false,
      penalty: false,
      slowdown: false
    },
  ];
  const getRandomCarNum = () => Math.floor(Math.random() * 35) + 1;
  standings.forEach((standing) => {
    standing.driver.carNum = getRandomCarNum().toString();
  });

  const [displayOrder, setDisplayOrder] = useState<string[]>(
    sortableSettings.map((s) => s.id)
  );

  const config = useMemo<RelativeWidgetSettings['config']>(
    () => ({
      buffer: 3,
      background: { opacity: 0 },
      position: { enabled: true },
      carNumber: { enabled: true },
      countryFlags: { enabled: true },
      driverName: { enabled: true },
      pitStatus: { enabled: true },
      carManufacturer: { enabled: true },
      badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
      iratingChange: { enabled: true },
      delta: { enabled: true },
      fastestTime: { enabled: true, timeFormat: 'full' },
      lastTime: { enabled: true, timeFormat: 'full' },
      compound: { enabled: true },
      brakeBias: { enabled: false },
      displayOrder: displayOrder,
      titleBar: { enabled: true, progressBar: { enabled: true } },
      showOnlyWhenOnTrack: false,
      enhancedGapCalculation: {
        enabled: true,
        interpolationMethod: 'linear',
        sampleInterval: 0.01,
        maxLapHistory: 5,
      },
    }),
    [displayOrder]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setDisplayOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const [parent] = useAutoAnimate();

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      <div className="flex-1">
        <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
          <tbody ref={parent}>
            {standings.map((result) => (
              <DriverInfoRow
                key={result.carIdx}
                carIdx={result.carIdx}
                classColor={result.carClass.color}
                carNumber={result.driver?.carNum || ''}
                name={result.driver?.name || ''}
                isPlayer={result.isPlayer}
                hasFastestTime={result.hasFastestTime}
                delta={result.delta}
                position={result.classPosition}
                onPitRoad={result.onPitRoad}
                onTrack={result.onTrack}
                radioActive={result.radioActive}
                isLapped={result.lappedState === 'behind'}
                isLappingAhead={result.lappedState === 'ahead'}
                flairId={result.driver?.flairId}
                tireCompound={result.tireCompound}
                carId={result.carId}
                badge={
                  <DriverRatingBadge
                    license={result.driver?.license}
                    rating={result.driver?.rating}
                  />
                }
                isMultiClass={false}
                currentSessionType={result.currentSessionType}
                displayOrder={displayOrder}
                config={config}
                fastestTime={result.fastestTime}
                lastTime={result.lastTime}
                iratingChange={<RatingChange value={result.iratingChange} />}
                dnf={result.dnf ?? false}
                repair={result.repair ?? false}
                penalty={result.penalty ?? false}
                slowdown={result.slowdown ?? false}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="w-64 bg-slate-800 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-slate-200 mb-4">
          Reorder Config
        </h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayOrder}
            strategy={verticalListSortingStrategy}
          >
            {displayOrder.map((id) => {
              const setting = sortableSettings.find((s) => s.id === id);
              return setting ? (
                <SortableItem key={id} id={id} label={setting.label} />
              ) : null;
            })}
          </SortableContext>
        </DndContext>
        <button
          onClick={() => {
            setDisplayOrder(sortableSettings.map((s) => s.id));
          }}
          className="mt-4 w-full px-3 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
        >
          Reset to Default
        </button>
      </div>
    </div>
  );
};

export const RelativeWithReorderableConfigStory: Story = {
  name: 'Relative with Reorderable Config',
  render: () => <RelativeWithReorderableConfig />,
};
