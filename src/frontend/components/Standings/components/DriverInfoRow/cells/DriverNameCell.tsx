import { memo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { DriverStatusBadges } from './DriverStatusBadges';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';
import { getPresetTag } from '../../../../../constants/driverTagBadges';
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
  skipWidgetTag?: boolean | undefined;
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
    skipWidgetTag = false,
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
      if (skipWidgetTag) return undefined;
      if (!tagSettings) return undefined;
      const displayEnabled = widgetTagEnabled ?? tagSettings.display?.enabled;
      if (!displayEnabled) return undefined;
      const key = fullName ?? name ?? '';
      const groupId = tagSettings.mapping?.[key] ?? tagSettings.mapping?.[name ?? ''];
      if (!groupId) return undefined;
      return getPresetTag(groupId);
    };

    const tag = getTagForDriver();

    const renderTagStrip = () => {
      if (!tag) return null;
      const preset = getPresetTag(tag.id);
      const icon = preset?.icon ?? '';
      return (
        <span style={{ display: 'inline-block', width: 20, height: 18, lineHeight: '18px', textAlign: 'center', borderRadius: 2, marginRight: 6 }}>
          <span className="align-middle">{icon}</span>
        </span>
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
