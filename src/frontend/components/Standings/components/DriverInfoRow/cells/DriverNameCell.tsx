import { memo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { DriverStatusBadges } from './DriverStatusBadges';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';
import { useDriverTag } from '../useDriverTag';
import DriverTagBadge from '../DriverTagBadge';
import type { DriverTagSettings } from '@irdashies/types';

interface DriverNameCellProps {
  name?: string;
  fullName?: string;
  nameFormat?: DriverNameFormat;
  radioActive?: boolean;
  repair?: boolean;
  penalty?: boolean;
  slowdown?: boolean;
  showStatusBadges?: boolean;
  tagSettings?: DriverTagSettings | undefined;
  widgetTagEnabled?: boolean | undefined;
  widgetTagBeforeName?: boolean | undefined;
  skipWidgetTag?: boolean | undefined;
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
    tagSettings,
    widgetTagEnabled,
    widgetTagBeforeName,
    skipWidgetTag = false,
  }: DriverNameCellProps) => {
    const displayName = fullName
      ? formatDriverName(
          extractDriverName(fullName),
          nameFormat ?? 'name-middlename-surname'
        )
      : name ?? '';

    // `tagSettings` is received via props when available; tests render this component without a provider, so it may be undefined.
    const tag = useDriverTag(fullName ?? name, tagSettings, widgetTagEnabled, skipWidgetTag ?? false);

    const renderTagStrip = () => {
      if (!tag) return null;
      return <DriverTagBadge tag={tag} widthPx={tagSettings?.display?.widthPx} displayStyle={tagSettings?.display?.displayStyle ?? 'badge'} />;
    };

    return (
      <td data-column="driverName" className="w-full max-w-0 px-1 py-0.5">
        <div className="flex items-center overflow-hidden">
          <span className={`animate-pulse transition-[width] duration-300 ${radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'}`}>
            <SpeakerHighIcon className="mt-px" size={16} />
          </span>

          {(widgetTagBeforeName ?? false) && renderTagStrip()}

          <div className="flex-1 min-w-0 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
            <span className="block truncate">{displayName}</span>
          </div>

          {!(widgetTagBeforeName ?? false) && renderTagStrip()}
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
