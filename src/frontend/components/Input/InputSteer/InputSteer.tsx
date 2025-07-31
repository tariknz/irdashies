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

export const InputSteer = ({
  angleRad = 0,
  wheelStyle = 'default',
  wheelColor = 'light',
}: InputSteerProps) => {
  const WheelComponent =
    wheelStyle in wheelComponentMap
      ? wheelComponentMap[wheelStyle][wheelColor]
      : wheelComponentMap.default[wheelColor];

  return (
    <div className="w-[120px] fill-white relative">
      <WheelComponent
        style={{
          width: '100%',
          height: '100%',
          transform: `rotate(${angleRad * -1}rad)`,
          transformBox: 'fill-box',
          transformOrigin: 'center',
        }}
      />
    </div>
  );
};
