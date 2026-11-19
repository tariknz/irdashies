import { useMemo, useRef, useEffect } from 'react';
import {
  DefaultB,
  DefaultW,
  FormulaB,
  FormulaW,
  LmpB,
  LmpW,
  NascarB,
  NascarW,
  UshapeB,
  UshapeW,
} from './wheels';
import { RotationIndicator } from './RotationIndicator';
import { SteerDial } from './SteerDial';
import type { SteerDialProps } from './SteerDial';

export type WheelStyle =
  'formula' | 'lmp' | 'nascar' | 'ushape' | 'default' | 'ring' | 'custom';

const wheelComponentMap = {
  default: {
    dark: DefaultB,
    light: DefaultW,
  },
  formula: {
    dark: FormulaB,
    light: FormulaW,
  },
  lmp: {
    dark: LmpB,
    light: LmpW,
  },
  nascar: {
    dark: NascarB,
    light: NascarW,
  },
  ushape: {
    dark: UshapeB,
    light: UshapeW,
  },
};

export interface InputSteerProps {
  angleRad?: number;
  wheelStyle?: WheelStyle;
  wheelColor?: 'dark' | 'light';
  /** Data URL for a user-uploaded wheel when style is `custom`. */
  customImageUrl?: string | null;
  /** Percent of telemetry angle used for the on-screen wheel (100 = 1:1). */
  rotationScale?: number;
  /** Used by the `ring` style to render gear + speed inside the dial. */
  gear?: number;
  speedMs?: number;
  unit?: number;
  gearSettings?: SteerDialProps['gearSettings'];
  flashColor?: SteerDialProps['flashColor'];
}

export function InputSteer({
  angleRad = 0,
  wheelStyle = 'default',
  wheelColor = 'light',
  customImageUrl,
  rotationScale = 100,
  gear,
  speedMs,
  unit,
  gearSettings,
  flashColor,
}: InputSteerProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const useCustomImage = wheelStyle === 'custom' && !!customImageUrl;
  const scaledAngleRad = angleRad * (rotationScale / 100);

  const WheelComponent = useMemo(() => {
    if (useCustomImage) return null;
    const entry =
      wheelComponentMap[wheelStyle as keyof typeof wheelComponentMap];
    return (entry ?? wheelComponentMap.default)[wheelColor];
  }, [wheelStyle, wheelColor, useCustomImage]);

  useEffect(() => {
    if (wheelRef.current) {
      wheelRef.current.style.setProperty(
        '--wheel-rotation',
        `${scaledAngleRad * -1}rad`
      );
    }
  }, [scaledAngleRad]);

  if (wheelStyle === 'ring') {
    return (
      <SteerDial
        angleRad={scaledAngleRad}
        gear={gear}
        speedMs={speedMs}
        unit={unit}
        wheelColor={wheelColor}
        gearSettings={gearSettings}
        flashColor={flashColor}
      />
    );
  }

  return (
    <div className="w-full h-full flex fill-white relative">
      <div
        ref={wheelRef}
        className="w-full h-full flex justify-center items-center"
        style={{
          transform: 'rotate(var(--wheel-rotation, 0rad))',
          transformBox: 'fill-box',
          transformOrigin: 'center',
          willChange: 'transform',
        }}
      >
        {useCustomImage ? (
          <img
            src={customImageUrl}
            alt=""
            className="max-w-full max-h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
        ) : (
          WheelComponent && <WheelComponent />
        )}
      </div>
      <RotationIndicator currentAngleRad={scaledAngleRad} />
    </div>
  );
}
