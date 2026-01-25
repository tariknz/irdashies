import { memo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { DriverStatusBadges } from './DriverStatusBadges';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';
import type { DriverTagSettings } from '@irdashies/types';

interface DriverNameCellProps {
  hidden?: boolean;
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
  widgetTagWidthPx?: number | undefined;
}

export const DriverNameCell = memo(
  ({
    hidden,
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
    widgetTagWidthPx,
  }: DriverNameCellProps) => {
    const displayName = hidden
      ? ''
      : fullName
      ? formatDriverName(
          extractDriverName(fullName),
          nameFormat ?? 'name-middlename-surname'
        )
      : name ?? '';

    // `tagSettings` is received via props when available; tests render this component without a provider, so it may be undefined.

    const getTagForDriver = () => {
      if (!tagSettings) return undefined;
      const displayEnabled = widgetTagEnabled ?? tagSettings.display?.enabled;
      if (!displayEnabled) return undefined;
      const key = fullName ?? name ?? '';
      const groupId = tagSettings.mapping?.[key] ?? tagSettings.mapping?.[name ?? ''];
      if (!groupId) return undefined;
      const group = tagSettings.groups?.find((g) => g.id === groupId);
      return group;
    };

    const tag = getTagForDriver();

    const renderTagStrip = () => {
      if (!tag) return null;
      const color = `#${tag.color.toString(16).padStart(6, '0')}`;
      const width = widgetTagWidthPx ?? tagSettings?.display?.widthPx ?? 6;
      return (
        <span
          style={{ width, height: 18, backgroundColor: color, display: 'inline-block', borderRadius: 1, marginRight: 6 }}
        />
      );
    };

    return (
      <td data-column="driverName" className="w-full max-w-0 px-1 py-0.5">
        <div className="flex items-center overflow-hidden">
          <span className={`animate-pulse transition-[width] duration-300 ${radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'}`}>
            <SpeakerHighIcon className="mt-px" size={16} />
          </span>

          {(widgetTagBeforeName ?? (tagSettings?.display?.position === 'before-name')) && renderTagStrip()}

          <div className="flex-1 min-w-0 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
            <span className="block truncate">{displayName}</span>
          </div>

          {!(widgetTagBeforeName ?? (tagSettings?.display?.position === 'before-name')) && renderTagStrip()}
          {showStatusBadges && (
            <DriverStatusBadges
              hidden={hidden}
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
