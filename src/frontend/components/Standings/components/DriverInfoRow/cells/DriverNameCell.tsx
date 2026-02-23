import { memo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';

// Module-level base for synchronized animation offset across all rows
const ANIMATION_SYNC_BASE_S = performance.now() / 1000;
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
    label,
    nameDisplay,
    alternateFrequency,
  }: DriverNameCellProps) => {
    const displayName = fullName
      ? formatDriverName(
          extractDriverName(fullName),
          nameFormat ?? 'name-middlename-surname'
        )
      : (name ?? '');

    const shouldAnimate = !!label && (!nameDisplay || nameDisplay === 'both');
    const staticText = nameDisplay === 'label' && label ? label : displayName;
    const freq = alternateFrequency ?? 5;
    const duration = `${freq}s`;
    const syncDelay = `-${(ANIMATION_SYNC_BASE_S % freq).toFixed(3)}s`;

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
                  className="absolute inset-0 flex items-center whitespace-nowrap animate-name-slide-primary"
                  style={{
                    animationDuration: duration,
                    animationDelay: syncDelay,
                  }}
                >
                  {displayName}
                </span>
                <span
                  className="absolute inset-0 flex items-center whitespace-nowrap animate-name-slide-secondary"
                  style={{
                    animationDuration: duration,
                    animationDelay: syncDelay,
                  }}
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
