import { BarbellIcon, UsersIcon } from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';

interface DriverClassHeaderProps {
  className: string | undefined;
  classColor: number | undefined;
  totalDrivers: number | undefined;
  sof: number | undefined;
  highlightColor?: number; 
  isMultiClass: boolean; 
}

export const DriverClassHeader = ({
  className,
  classColor,
  totalDrivers,
  sof,
  highlightColor, 
  isMultiClass,
}: DriverClassHeaderProps) => {
  if (!className) {
    return (
      <tr>
        <td colSpan={6} className="pb-3"></td>
      </tr>
    );
  }

  return (
    <tr>
      <td></td>
      <td colSpan={4} className="p-0">
        <div className={`[text-shadow:_1px_1px_1px_rgba(0_0_0/0.2)] mt-3 flex`}>
          <span
            className={`${getTailwindStyle(classColor, highlightColor, isMultiClass).classHeader} px-2 py-1 font-bold border-l-4`}
          >
            {className}
          </span>
          <span
            className={`${getTailwindStyle(classColor, highlightColor, isMultiClass).driverIcon} px-2 py-1 flex items-center gap-1`}
          >
            {sof ? (
              <>
                <BarbellIcon /> <span>{sof?.toFixed(0)}</span>
              </>
            ) : (
              ''
            )}{' '}
            <UsersIcon className={sof ? "ml-3" : ""} />
            <span>{totalDrivers}</span>
          </span>
        </div>
      </td>
    </tr>
  );
};
