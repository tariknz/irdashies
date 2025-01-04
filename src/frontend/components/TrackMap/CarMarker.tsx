import { Driver } from '@irdashies/types';
import { getTailwindColor } from '../../utils/colors';

export const CarMarker = ({
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
