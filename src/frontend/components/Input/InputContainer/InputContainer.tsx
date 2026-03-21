import { useMemo } from 'react';
import { InputWidgetSettings } from '@irdashies/types';
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
  settings: InputWidgetSettings['config'];
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

  // Only recompute section order when settings change (not every telemetry frame)
  const orderedSections = useMemo(() => {
    const allSections: { id: InputSection; enabled: boolean }[] = [
      { id: 'trace', enabled: settings.trace.enabled },
      { id: 'bar', enabled: settings.bar.enabled },
      { id: 'gear', enabled: settings.gear.enabled },
      { id: 'abs', enabled: settings.abs.enabled },
      { id: 'steer', enabled: settings.steer.enabled },
    ];

    const enabledSections = allSections.filter((s) => s.enabled);

    if (!displayOrder) {
      return enabledSections.map((s) => s.id);
    }

    const ordered = displayOrder.filter((id) =>
      enabledSections.some((s) => s.id === id)
    );
    const remaining = enabledSections
      .filter((s) => !displayOrder.includes(s.id))
      .map((s) => s.id);

    return [...ordered, ...remaining];
  }, [settings, displayOrder]);

  const renderSection = (id: InputSection) => {
    switch (id) {
      case 'trace':
        return (
          <div key="trace" className="flex flex-4">
            <InputTrace
              input={{ brake, throttle, clutch, brakeAbsActive, steer }}
              settings={settings?.trace}
            />
          </div>
        );
      case 'bar':
        return (
          <div key="bar" className="flex flex-1 min-w-0">
            <InputBar
              brake={brake}
              brakeAbsActive={brakeAbsActive}
              throttle={throttle}
              clutch={clutch}
              settings={settings.bar}
            />
          </div>
        );
      case 'gear':
        return (
          <div key="gear" className="flex flex-1 min-w-0">
            <InputGear
              gear={gear}
              speedMs={speed}
              unit={unit}
              settings={settings.gear}
            />
          </div>
        );
      case 'abs':
        return (
          <div
            key="abs"
            className="flex flex-1 min-w-0 items-center justify-center p-2"
          >
            <InputAbsIndicator
              absActive={brakeAbsActive ?? false}
              className="w-full h-full aspect-[512/357.25]"
            />
          </div>
        );
      case 'steer':
        return (
          <div key="steer" className="flex flex-1 min-w-0">
            <InputSteer
              angleRad={steer}
              wheelStyle={settings?.steer?.config?.style}
              wheelColor={settings?.steer?.config?.color}
            />
          </div>
        );
    }
  };

  return (
    <div
      className="w-full h-full inline-flex gap-1 p-2 rounded-md flex-row bg-slate-800/(--bg-opacity)"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      {orderedSections.map(renderSection)}
    </div>
  );
};
