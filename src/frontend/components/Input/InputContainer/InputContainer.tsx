import { memo, useCallback, useMemo, type ReactNode } from 'react';
import type { InputWidgetSettings, LayoutNode } from '@irdashies/types';
import { InputAbsIndicator } from '../InputAbsIndicator/InputAbsIndicator';
import { InputBar } from '../InputBar/InputBar';
import { InputGear } from '../InputGear/InputGear';
import { InputSteer } from '../InputSteer/InputSteer';
import { InputTrace } from '../InputTrace/InputTrace';
import { getInputLayoutTree } from '../layout';

export interface InputProps {
  brake?: number;
  throttle?: number;
  clutch?: number;
  gear?: number;
  speed?: number;
  unit?: number;
  steer?: number;
  brakeAbsActive?: boolean;
  settings: InputWidgetSettings['config'];
}

interface LayoutNodeViewProps {
  node: LayoutNode;
  renderElement: (id: string) => ReactNode;
}

// Declared at module level so its identity is stable. A component declared
// inside render would remount every element (and wipe the trace) each frame.
const LayoutNodeView = ({ node, renderElement }: LayoutNodeViewProps) => {
  const style = { flex: `${node.weight || 1} 1 0%` };
  const direction = node.direction === 'row' ? 'flex-row' : 'flex-col';

  if (node.type === 'box') {
    return (
      <div className={`flex ${direction} gap-1 min-w-0 min-h-0`} style={style}>
        {[...new Set(node.widgets)].map((id) => (
          <div key={id} className="flex flex-1 min-w-0 min-h-0">
            {renderElement(id)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex ${direction} gap-1 min-w-0 min-h-0`} style={style}>
      {node.children.map((child) => (
        <LayoutNodeView
          key={child.id}
          node={child}
          renderElement={renderElement}
        />
      ))}
    </div>
  );
};

export const InputContainer = memo(
  ({
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
    const tree = useMemo(() => getInputLayoutTree(settings), [settings]);

    const renderElement = useCallback(
      (id: string) => {
        switch (id) {
          case 'trace':
            return (
              <InputTrace
                input={{ brake, throttle, clutch, brakeAbsActive, steer }}
                settings={settings.trace}
              />
            );
          case 'bar':
            return (
              <InputBar
                brake={brake}
                brakeAbsActive={brakeAbsActive}
                throttle={throttle}
                clutch={clutch}
                settings={settings.bar}
              />
            );
          case 'gear':
            return (
              <InputGear
                gear={gear}
                speedMs={speed}
                unit={unit}
                settings={settings.gear}
              />
            );
          case 'abs':
            return (
              <div className="flex flex-1 min-w-0 items-center justify-center p-2">
                <InputAbsIndicator
                  absActive={brakeAbsActive ?? false}
                  className="w-full h-full aspect-[512/357.25]"
                />
              </div>
            );
          case 'steer':
            return (
              <InputSteer
                angleRad={steer}
                wheelStyle={settings.steer.config?.style}
                wheelColor={settings.steer.config?.color}
                gear={gear}
                speedMs={speed}
                unit={unit}
                gearSettings={settings.gear}
              />
            );
          default:
            return null;
        }
      },
      [
        brake,
        throttle,
        clutch,
        gear,
        speed,
        steer,
        unit,
        brakeAbsActive,
        settings,
      ]
    );

    return (
      <div
        className="w-full h-full flex p-2 rounded-md bg-slate-800/(--bg-opacity)"
        style={{
          ['--bg-opacity' as string]: `${settings.background?.opacity ?? 80}%`,
        }}
      >
        <LayoutNodeView node={tree} renderElement={renderElement} />
      </div>
    );
  }
);
InputContainer.displayName = 'InputContainer';
