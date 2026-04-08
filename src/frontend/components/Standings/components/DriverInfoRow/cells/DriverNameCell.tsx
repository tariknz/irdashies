import { memo, useRef } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { DriverStatusBadges } from './DriverStatusBadges';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';
import { useCyclingAnimation } from './useCyclingAnimation';

interface DriverNameCellProps {
  name?: string;
  fullName?: string;
  nameFormat?: DriverNameFormat;
  radioActive?: boolean;
  repair?: boolean;
  penalty?: boolean;
  slowdown?: boolean;
  showStatusBadges?: boolean;
  isMinimalStatusBadges?: boolean;
  removeNumbersFromName?: boolean;
  label?: string;
  nameDisplay?: 'both' | 'label' | 'name';
  animationCycleTime?: number;
  compactMode?: string;
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
    isMinimalStatusBadges = false,
    removeNumbersFromName = false,
    label,
    nameDisplay,
    animationCycleTime,
    compactMode,
  }: DriverNameCellProps) => {
    const displayName = fullName
      ? formatDriverName(
          extractDriverName(fullName, removeNumbersFromName),
          nameFormat ?? 'name-middlename-surname'
        )
      : (name ?? '');

    const shouldAnimate = !!label && (!nameDisplay || nameDisplay === 'both');
    const staticText = nameDisplay === 'label' && label ? label : displayName;
    const freq = animationCycleTime ?? 5;
    const spanPrimaryRef = useRef<HTMLSpanElement>(null);
    const spanSecondaryRef = useRef<HTMLSpanElement>(null);

    // Use shared cycling animation hook
    useCyclingAnimation(
      [spanPrimaryRef, spanSecondaryRef],
      freq * 2 * 1000,
      shouldAnimate
    );

    return (
      <td
        data-column="driverName"
        className={`w-full max-w-0 ${compactMode !== 'ultra' ? ' px-1 py-0.5' : ''}`}
      >
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
                  className="absolute inset-0 flex items-center whitespace-nowrap"
                  style={{ opacity: 1 }}
                >
                  {displayName}
                </span>
                <span
                  ref={spanSecondaryRef}
                  className="absolute inset-0 flex items-center whitespace-nowrap"
                  style={{ opacity: 0 }}
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
              isMinimal={isMinimalStatusBadges}
              className="shrink-0"
            />
          )}
        </div>
      </td>
    );
  }
);

DriverNameCell.displayName = 'DriverNameCell';
