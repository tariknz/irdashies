import { useEffect, useRef, useState } from 'react';
import { Driver } from '@irdashies/types';
import { getTailwindColor } from '../../utils/colors';
import tracks from './tracks/tracks.json';

export type TrackProps = {
  trackId: number;
  drivers: TrackDriver[];
};

export type TrackDriver = {
  driver: Driver;
  progress: number;
  isPlayer: boolean;
};

interface TrackDrawing {
  active: {
    inside: string;
    outside: string;
  };
  startFinish: {
    line?: string;
    arrow?: string;
    point?: { x?: number; y?: number; length?: number } | null;
    direction?: 'clockwise' | 'anticlockwise' | null;
  };
  turns?: {
    x?: number;
    y?: number;
    content?: string;
  }[];
}

export const Track = ({ trackId, drivers }: TrackProps) => {
  const insideRef = useRef<SVGPathElement>(null);
  const [positions, setPositions] = useState<
    Record<number, TrackDriver & { position: { x: number; y: number } }>
  >({});
  const trackDrawing = (tracks as unknown as TrackDrawing[])[trackId];

  useEffect(() => {
    const ref = insideRef?.current;

    if (!ref) return;
    if (!trackDrawing?.startFinish?.point?.length) return;
    if (!drivers?.length) return;

    const direction = trackDrawing.startFinish?.direction;
    const intersectionLength = trackDrawing.startFinish?.point?.length || 0;
    const totalLength = ref.getTotalLength() || 0;

    function updateCarPosition(percent: number) {
      const adjustedLength = (totalLength * percent) % totalLength;
      const length =
        direction === 'anticlockwise'
          ? (intersectionLength + adjustedLength) % totalLength
          : (intersectionLength - adjustedLength + totalLength) % totalLength;
      const point = ref?.getPointAtLength(length);

      return { x: point?.x || 0, y: point?.y || 0 };
    }

    const updatedPositions = drivers.reduce(
      (acc, { driver, progress, isPlayer }) => {
        const position = updateCarPosition(progress);
        return {
          ...acc,
          [driver.CarIdx]: { position, driver, isPlayer, progress },
        };
      },
      {} as Record<number, TrackDriver & { position: { x: number; y: number } }>
    );

    setPositions(updatedPositions);
  }, [
    drivers,
    trackDrawing?.startFinish?.direction,
    trackDrawing?.startFinish?.point?.length,
  ]);

  if (!trackDrawing?.active?.inside) {
    return <>Track map unavailable</>;
  }

  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      viewBox="0 0 1920 1080"
      xmlSpace="preserve"
    >
      <path
        ref={insideRef}
        className="fill-none stroke-white stroke-[20] drop-shadow"
        d={trackDrawing.active.inside}
      />
      <path className="fill-red-500" d={trackDrawing.startFinish?.line} />

      {trackDrawing.turns?.map((turn, i) => (
        <text
          key={i + trackId}
          x={turn.x}
          y={turn.y} // offset to center as we're rendering only the inside line
          className="fill-white text-4xl drop-shadow"
        >
          {turn.content}
        </text>
      ))}

      {Object.values(positions)
        .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer)) // player renders last to be on top
        .map(({ driver, position, isPlayer }) => (
          <CarMarker
            key={driver.CarIdx}
            position={position}
            isPlayer={isPlayer}
            driver={driver}
          />
        ))}
    </svg>
  );
};

const CarMarker = ({
  position,
  driver,
  isPlayer,
}: {
  position: { x: number; y: number };
  isPlayer?: boolean;
  driver?: Driver;
}) => {
  if (!position?.x || !position?.y) return null;

  const markerBaseSize = 40;
  const markerSize = isPlayer ? markerBaseSize * 1.4 : markerBaseSize;

  return (
    <>
      <circle
        transform={`translate(${position.x}, ${position.y})`}
        r={markerSize}
        className={`${isPlayer ? 'fill-yellow-500' : getTailwindColor(driver?.CarClassColor).fill} transition-transform duration-50 drop-shadow-md`}
      />
      <text
        transform={`translate(${position.x}, ${position.y})`}
        className={`fill-white transition-transform duration-50 drop-shadow-md font-extrabold`}
        style={{
          textAnchor: 'middle',
          fontSize: `${markerSize}px`,
          alignmentBaseline: 'central',
        }}
      >
        {driver?.CarNumber}
      </text>
    </>
  );
};
