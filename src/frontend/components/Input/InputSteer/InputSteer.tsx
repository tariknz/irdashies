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

export type WheelStyle = 'formula' | 'lmp' | 'nascar' | 'ushape' | 'default';

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
}

export function InputSteer({
  angleRad = 0,
  wheelStyle = 'default',
  wheelColor = 'light',
}: InputSteerProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  
  // Memoize the wheel component selection (only changes when style/color change)
  const WheelComponent = useMemo(() => {
    return wheelStyle in wheelComponentMap
      ? wheelComponentMap[wheelStyle][wheelColor]
      : wheelComponentMap.default[wheelColor];
  }, [wheelStyle, wheelColor]);

  // Use CSS custom properties for smooth updates without React re-renders
  useEffect(() => {
    if (wheelRef.current) {
      wheelRef.current.style.setProperty('--wheel-rotation', `${angleRad * -1}rad`);
    }
  }, [angleRad]);

  return (
    <div className="w-[120px] h-full flex fill-white relative">
      <div
        ref={wheelRef}
        className='w-full h-full flex'
        style={{
          transform: 'rotate(var(--wheel-rotation, 0rad))',
          transformBox: 'fill-box',
          transformOrigin: 'center',
          willChange: 'transform',
        }}
      >
        <WheelComponent />
      </div>
      <RotationIndicator currentAngleRad={angleRad} />
    </div>
  );
}
