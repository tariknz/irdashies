import { BarbellIcon, UsersIcon } from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import type { ClassHeaderStyle } from '@irdashies/types';
import { CarManufacturer } from '../CarManufacturer/CarManufacturer';

interface DriverClassHeaderProps {
  className: string | undefined;
  classColor: number | undefined;
  totalDrivers: number | undefined;
  sof: number | undefined;
  highlightColor?: number;
  isMultiClass: boolean;
  colSpan?: number;
  classHeaderStyle?: ClassHeaderStyle;
  compactMode?: string;
  manufacturerCounts?: { carId: number; count: number }[];
  playerManufacturerEntry?: { carId: number; count: number };
}

export const DriverClassHeader = ({
  className,
  classColor,
  totalDrivers,
  sof,
  highlightColor,
  isMultiClass,
  colSpan,
  classHeaderStyle,
  compactMode,
  manufacturerCounts,
  playerManufacturerEntry,
}: DriverClassHeaderProps) => {
  if (!className) {
    return (
      <tr>
        <td colSpan={colSpan ? colSpan : 6} className="pb-3"></td>
      </tr>
    );
  }

  const styles = getTailwindStyle(classColor, highlightColor, isMultiClass);
  const classNameColorBackground =
    classHeaderStyle?.className?.colorBackground ?? true;
  const classInfoColorBackground =
    classHeaderStyle?.classInfo?.colorBackground ?? true;
  const classDividerBottomBorder =
    classHeaderStyle?.classDivider?.bottomBorder ?? false;

  const classNameStyle = classNameColorBackground
    ? styles.classHeader
    : styles.borderColor;
  const classInfoStyle = classInfoColorBackground
    ? styles.driverIcon
    : styles.borderColor;
  const py = compactMode === 'ultra' ? '' : ' py-1';

  return (
    <tr>
      <td></td>
      <td
        colSpan={colSpan ?? 4}
        className={`p-0${classDividerBottomBorder ? ` border-b-2 ${styles.borderColor}` : ''}`}
      >
        <div className={`[text-shadow:_1px_1px_1px_rgba(0_0_0/0.2)] flex`}>
          <span
            className={`${classNameStyle} px-2${py} font-bold${classNameColorBackground ? ' border-l-4' : ''}`}
          >
            {className}
          </span>
          <span
            className={`${classInfoStyle} px-2${py} flex items-center gap-1`}
          >
            {sof ? (
              <>
                <BarbellIcon />{' '}
                <span>
                  {classHeaderStyle?.compactSof && sof >= 1000
                    ? `${(sof / 1000).toFixed(1)}k`
                    : sof.toFixed(0)}
                </span>
              </>
            ) : (
              ''
            )}{' '}
            <UsersIcon className={sof ? 'ml-3' : ''} />
            <span>{totalDrivers}</span>
            {(() => {
              const stats = classHeaderStyle?.manufacturerStats;
              if (!stats?.enabled) return null;
              if (!manufacturerCounts || manufacturerCounts.length <= 1) return null;

              // undefined → default cap 5; null → All; number → specific cap
              const rawCap = stats.cap;
              const capValue = rawCap !== undefined ? rawCap : 5;

              let visible =
                capValue === null
                  ? [...manufacturerCounts]
                  : manufacturerCounts.slice(0, capValue);
              const totalHidden = manufacturerCounts.length - visible.length;

              if (
                stats.showPlayerManufacturer &&
                playerManufacturerEntry &&
                totalHidden > 0 &&
                !visible.some((v) => v.carId === playerManufacturerEntry.carId)
              ) {
                visible = [
                  ...visible.slice(0, visible.length - 1),
                  playerManufacturerEntry,
                ];
              }

              const hidden = manufacturerCounts.length - visible.length;
              return (
                <>
                  {visible.map(({ carId, count }) => (
                    <span key={carId} className="flex items-center gap-0.5 ml-2">
                      <CarManufacturer carId={carId} />
                      <span>{count}</span>
                    </span>
                  ))}
                  {hidden > 0 && (
                    <span className="ml-1 text-white/50">+{hidden}</span>
                  )}
                </>
              );
            })()}
          </span>
        </div>
      </td>
    </tr>
  );
};
