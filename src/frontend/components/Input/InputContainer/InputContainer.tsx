import { Fragment, useMemo } from 'react';
import { InputWidgetSettings } from '../../Settings/types';
import { InputAbsIndicator } from '../InputAbsIndicator/InputAbsIndicator';
import { InputBar } from '../InputBar/InputBar';
import { InputGear } from '../InputGear/InputGear';
import { InputSteer } from '../InputSteer/InputSteer';
import { InputTrace } from '../InputTrace/InputTrace';

export interface InputProps {
  brake?: number;
  throttle?: number;
  clutch?: number;
  gear?: number;
  speed?: number;
  unit?: number;
  steer?: number;
  brakeAbsActive?: boolean;
  settings?: InputWidgetSettings['config'];
}

type InputSection = 'trace' | 'bar' | 'gear' | 'abs' | 'steer';

export const InputContainer = ({
  brake,
  throttle,
  clutch,
  gear,
  speed,
  steer,
  unit,
  brakeAbsActive,
  settings,
}: InputProps) => {
  const displayOrder = settings?.displayOrder as InputSection[] | undefined;

  const columnDefinitions = useMemo(() => {
    const columns = [
      {
        id: 'trace' as const,
        shouldRender: settings?.trace?.enabled ?? true,
        component: (
          <div className="flex flex-4">
            <InputTrace
              key="trace"
              input={{ brake, throttle, clutch, brakeAbsActive, steer }}
              settings={settings?.trace}
            />
          </div>
        ),
      },
      {
        id: 'bar' as const,
        shouldRender: settings?.bar?.enabled ?? true,
        component: (
          <div className="flex flex-1 min-w-0">
            <InputBar
              key="bar"
              brake={brake}
              brakeAbsActive={brakeAbsActive}
              throttle={throttle}
              clutch={clutch}
              settings={settings?.bar}
            />
          </div>
        ),
      },
      {
        id: 'gear' as const,
        shouldRender: settings?.gear?.enabled ?? true,
        component: (
          <div className="flex flex-1 min-w-0">
            <InputGear
              key="gear"
              gear={gear}
              speedMs={speed}
              unit={unit}
              settings={settings?.gear}
            />
          </div>
        ),
      },
      {
        id: 'abs' as const,
        shouldRender: settings?.abs?.enabled ?? true,
        component: (
          <div className="flex flex-1 min-w-0 items-center justify-center p-2">
            <InputAbsIndicator
              key="abs"
              absActive={brakeAbsActive ?? false}
              className="w-full h-full aspect-[512/357.25]"
            />
          </div>
        ),
      },
      {
        id: 'steer' as const,
        shouldRender: settings?.steer?.enabled ?? true,
        component: (
          <div className="flex flex-1 min-w-0">
            <InputSteer
              key="steer"
              angleRad={steer}
              wheelStyle={settings?.steer?.config?.style}
              wheelColor={settings?.steer?.config?.color}
            />
          </div>
        ),
      },
    ];

    if (!displayOrder) {
      return columns.filter((column) => column.shouldRender);
    }

    const orderedColumns = displayOrder
      .map((orderId) => columns.find((column) => column.id === orderId))
      .filter(
        (column): column is NonNullable<typeof column> =>
          column !== undefined && column.shouldRender
      );

    const remainingColumns = columns.filter(
      (column) => column.shouldRender && !displayOrder.includes(column.id)
    );

    return [...orderedColumns, ...remainingColumns];
  }, [
    brake,
    throttle,
    clutch,
    gear,
    speed,
    unit,
    brakeAbsActive,
    steer,
    settings,
    displayOrder,
  ]);

  return (
    <div
      className="w-full h-full inline-flex gap-1 p-2 flex-row bg-slate-800/(--bg-opacity)"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      {columnDefinitions.map((column) => (
        <Fragment key={column.id}>{column.component}</Fragment>
      ))}
    </div>
  );
};
