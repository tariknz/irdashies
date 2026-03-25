import { memo, useRef, useLayoutEffect } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { DriverStatusBadges } from './DriverStatusBadges';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';

interface DriverNameCellProps {
  name?: string;
  fullName?: string;
  nameFormat?: DriverNameFormat;
  radioActive?: boolean;
  repair?: boolean;
  penalty?: boolean;
  slowdown?: boolean;
  showStatusBadges?: boolean;
  removeNumbersFromName?: boolean;
  label?: string;
  nameDisplay?: 'both' | 'label' | 'name';
  alternateFrequency?: number;
}

export const DriverNameCell = memo(
  ({
    name,
    fullName,
    nameFormat,
    radioActive,
    repair,
    penalty,
    slowdown,
    showStatusBadges = true,
    removeNumbersFromName = false,
    label,
    nameDisplay,
    alternateFrequency,
  }: DriverNameCellProps) => {
    const displayName = fullName
      ? formatDriverName(
          extractDriverName(fullName, removeNumbersFromName),
          nameFormat ?? 'name-middlename-surname'
        )
      : (name ?? '');

    const shouldAnimate = !!label && (!nameDisplay || nameDisplay === 'both');
    const staticText = nameDisplay === 'label' && label ? label : displayName;
    const freq = alternateFrequency ?? 5;
    const duration = `${freq}s`;
    const spanPrimaryRef = useRef<HTMLSpanElement>(null);
    const spanSecondaryRef = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
      if (!shouldAnimate) return;
      const delay = `-${((Date.now() / 1000) % freq).toFixed(3)}s`;
      if (spanPrimaryRef.current)
        spanPrimaryRef.current.style.animationDelay = delay;
      if (spanSecondaryRef.current)
        spanSecondaryRef.current.style.animationDelay = delay;
    }, [shouldAnimate, freq]);

    return (
      <td data-column="driverName" className="w-full max-w-0 px-1 py-0.5">
        <div className="flex items-center overflow-hidden">
          <span
            className={`animate-pulse transition-[width] duration-300 ${
              radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'
            }`}
          >
            <SpeakerHighIcon className="mt-px" size={16} />
          </span>

          <div className="flex-1 min-w-0 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
            {shouldAnimate ? (
              <div className="relative overflow-hidden h-[1lh]">
                <span
                  ref={spanPrimaryRef}
                  className="absolute inset-0 flex items-center whitespace-nowrap animate-name-slide-primary"
                  style={{ animationDuration: duration }}
                >
                  {displayName}
                </span>
                <span
                  ref={spanSecondaryRef}
                  className="absolute inset-0 flex items-center whitespace-nowrap animate-name-slide-secondary"
                  style={{ animationDuration: duration }}
                >
                  {label}
                </span>
              </div>
            ) : (
              <span className="block truncate">{staticText}</span>
            )}
          </div>

          {showStatusBadges && (
            <DriverStatusBadges
              repair={repair}
              penalty={penalty}
              slowdown={slowdown}
              className="shrink-0"
            />
          )}
        </div>
      </td>
    );
  }
);

DriverNameCell.displayName = 'DriverNameCell';
