import { BarbellIcon, UsersIcon } from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import type { ClassHeaderStyle } from '@irdashies/types';

interface DriverClassHeaderProps {
  className: string | undefined;
  classColor: number | undefined;
  totalDrivers: number | undefined;
  sof: number | undefined;
  highlightColor?: number;
  isMultiClass: boolean;
  colSpan?: number;
  classHeaderStyle?: ClassHeaderStyle;
  compactMode?: boolean | string;
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
                <BarbellIcon /> <span>{sof?.toFixed(0)}</span>
              </>
            ) : (
              ''
            )}{' '}
            <UsersIcon className={sof ? 'ml-3' : ''} />
            <span>{totalDrivers}</span>
          </span>
        </div>
      </td>
    </tr>
  );
};
