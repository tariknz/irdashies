import { BarbellIcon, UsersIcon } from '@phosphor-icons/react';
import { useGeneralSettings } from '@irdashies/context';
import { getTailwindStyle } from '@irdashies/utils/colors';

interface DriverClassHeaderProps {
  className: string | undefined;
  classColor: number | undefined;
  totalDrivers: number | undefined;
  sof: number | undefined;
  highlightColor?: number;
  isMultiClass: boolean;
  classNameColorBackground?: boolean;
  classInfoColorBackground?: boolean;
  classDividerBottomBorder?: boolean;
  colSpan?: number;
}

export const DriverClassHeader = ({
  className,
  classColor,
  totalDrivers,
  sof,
  highlightColor,
  isMultiClass,
  classNameColorBackground = true,
  classInfoColorBackground = true,
  classDividerBottomBorder = false,
  colSpan,
}: DriverClassHeaderProps) => {
  const generalSettings = useGeneralSettings();
  const styles = getTailwindStyle(classColor, highlightColor, isMultiClass);
  const classNameStyle = classNameColorBackground
    ? styles.classHeader
    : styles.borderColor;
  const classInfoStyle = classInfoColorBackground
    ? styles.driverIcon
    : styles.borderColor;

  if (!className) {
    return (
      <tr>
        <td colSpan={colSpan ? colSpan : 6} className="pb-3"></td>
      </tr>
    );
  }

  return (
    <tr>
      <td
        className={`${classDividerBottomBorder ? ` border-b-4 ${styles.borderColor}` : ''}`}
      ></td>
      <td
        colSpan={colSpan ?? 4}
        className={`p-0${classDividerBottomBorder ? ` border-b-4 ${styles.borderColor}` : ''}`}
      >
        <div className={`[text-shadow:_1px_1px_1px_rgba(0_0_0/0.2)] flex`}>
          <span
            className={`${classNameStyle} px-2${generalSettings?.compactMode !== 'ultra' ? ' py-1' : ''} font-bold${classNameColorBackground ? ' border-l-4' : ''}`}
          >
            {className}
          </span>
          <span
            className={`${classInfoStyle} px-2${generalSettings?.compactMode !== 'ultra' ? ' py-1' : ''} flex items-center gap-1`}
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
