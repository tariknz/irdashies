import { CarLeftRight } from '@irdashies/types';
import { useEffect, useRef, useState } from 'react';

export interface BlindSpotMonitorIndicatorProps {
  side: 'left' | 'right';
  bgOpacity?: number;
  percent: number;
  state: CarLeftRight;
  width?: number;
  borderSize?: number;
  indicatorColor?: number;
  visible: boolean;
  disableTransition: boolean;
}

export const BlindSpotMonitorIndicator = ({
  side,
  bgOpacity,
  percent,
  state,
  width,
  borderSize,
  indicatorColor,
  visible,
  disableTransition,
}: BlindSpotMonitorIndicatorProps) => {
  const isTwoCars =
    state === CarLeftRight.Cars2Left || state === CarLeftRight.Cars2Right;
  const topPosition = `${25 - percent * 75}%`;
  const widthPx = `${width ?? 20}px`;
  const indicatorColorHex = `#${(indicatorColor ?? 16096779).toString(16).padStart(6, '0')}`;
  const twoCarsText = state === CarLeftRight.Cars2Left ? '2 left' : '2 right';
  const transitionTimeoutRef = useRef<number | null>(null);
  const [enableTransition, setEnableTransition] = useState(false);

  useEffect(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    if (visible && !disableTransition && !enableTransition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnableTransition(false);
      transitionTimeoutRef.current = window.setTimeout(() => {
        setEnableTransition(true);
      }, 33);
    } else if (disableTransition || !visible) {
      setEnableTransition(false);
    }

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [visible, disableTransition, enableTransition]);

  return (
    <div
      className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'}`}
      style={{ display: visible ? 'block' : 'none' }}
    >
      <div
        className={`absolute inset-y-0 rounded-full ${side === 'left' ? 'left-0' : 'right-0'} overflow-hidden`}
        style={{
          backgroundColor:
            bgOpacity !== undefined && bgOpacity > 0
              ? `rgba(0, 0, 0, ${bgOpacity / 100})`
              : 'transparent',
          borderStyle: 'solid',
          borderWidth: `${borderSize ?? 1}px`,
          borderColor:
            bgOpacity !== undefined && bgOpacity > 0
              ? `rgba(0, 0, 0, ${bgOpacity / 100})`
              : 'transparent',
          width: widthPx,
        }}
      >
        <div
          className={`absolute rounded-full h-[50%] left-1/2 -translate-x-1/2 flex items-center justify-center`}
          style={{
            top: topPosition,
            width: widthPx,
            backgroundColor: indicatorColorHex,
            transition: enableTransition ? 'top 0.04s linear' : 'none',
          }}
        ></div>

        {isTwoCars && (
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
              side === 'left' ? 'rotate-180' : ''
            } bg-black/70 px-2 py-0.5 rounded-full text-amber-500 text-xs font-semibold whitespace-nowrap animate-blink text-shadow-md`}
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
            }}
          >
            {twoCarsText}
          </div>
        )}
      </div>
    </div>
  );
};
