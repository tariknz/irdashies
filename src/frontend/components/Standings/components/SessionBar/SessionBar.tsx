import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import type { SessionBarConfig } from '@irdashies/types';
import { DriverBadgeItem } from './DriverBadgeItem';
import { SofItem } from './SofItem';
import { ClassDriversItem } from './ClassDriversItem';
import { SessionNameItem } from './SessionNameItem';
import { SessionTimeItem } from './SessionTimeItem';
import { SessionLapsItem } from './SessionLapsItem';
import { IncidentCountItem } from './IncidentCountItem';
import { BrakeBiasItem } from './BrakeBiasItem';
import { LocalTimeItem } from './LocalTimeItem';
import { SessionClockTimeItem } from './SessionClockTimeItem';
import { TrackWetnessItem } from './TrackWetnessItem';
import { PrecipitationItem } from './PrecipitationItem';
import { AirTemperatureItem } from './AirTemperatureItem';
import { TrackTemperatureItem } from './TrackTemperatureItem';
import { TrackNameItem } from './TrackNameItem';
import { WindItem } from './WindItem';
import { HumidityItem } from './HumidityItem';

interface SessionBarProps {
  settings: SessionBarConfig;
  position?: 'header' | 'footer';
  standalone?: boolean;
  opacity?: number;
}

const DEFAULT_HEADER_ORDER = [
  'sessionName',
  'sessionTime',
  'sessionLaps',
  'localTime',
  'brakeBias',
  'incidentCount',
];

const DEFAULT_FOOTER_ORDER = [
  'localTime',
  'trackWetness',
  'sessionLaps',
  'airTemperature',
  'trackTemperature',
];

const isItemEnabled = (
  key: string,
  settings: SessionBarConfig | undefined,
  position: 'header' | 'footer'
): boolean => {
  switch (key) {
    case 'sessionName':
      return (
        settings?.sessionName?.enabled ?? (position === 'header' ? true : false)
      );
    case 'sessionTime':
      return (
        settings?.sessionTime?.enabled ?? (position === 'header' ? true : false)
      );
    case 'sessionLaps':
      return settings?.sessionLaps?.enabled ?? true;
    case 'incidentCount':
      return (
        settings?.incidentCount?.enabled ??
        (position === 'header' ? true : false)
      );
    case 'brakeBias':
      return settings?.brakeBias?.enabled ?? true;
    case 'localTime':
      return settings?.localTime?.enabled ?? true;
    case 'sessionClockTime':
      return settings?.sessionClockTime?.enabled ?? false;
    case 'trackWetness':
      return (
        settings?.trackWetness?.enabled ??
        (position === 'header' ? false : true)
      );
    case 'precipitation':
      return settings?.precipitation?.enabled ?? false;
    case 'airTemperature':
      return (
        settings?.airTemperature?.enabled ??
        (position === 'header' ? false : true)
      );
    case 'trackTemperature':
      return (
        settings?.trackTemperature?.enabled ??
        (position === 'header' ? false : true)
      );
    case 'trackName':
      return settings?.trackName?.enabled ?? false;
    case 'wind':
      return settings?.wind?.enabled ?? false;
    case 'humidity':
      return settings?.humidity?.enabled ?? false;
    case 'driverBadge':
      return settings?.driverBadge?.enabled ?? false;
    case 'sof':
      return settings?.sof?.enabled ?? false;
    case 'classDrivers':
      return settings?.classDrivers?.enabled ?? false;
    default:
      return false;
  }
};

const renderItem = (
  key: string,
  settings: SessionBarConfig | undefined
): React.ReactNode => {
  switch (key) {
    case 'sessionName':
      return <SessionNameItem />;
    case 'sessionTime':
      return <SessionTimeItem settings={settings?.sessionTime} />;
    case 'sessionLaps':
      return <SessionLapsItem settings={settings?.sessionLaps} />;
    case 'incidentCount':
      return <IncidentCountItem />;
    case 'brakeBias':
      return <BrakeBiasItem />;
    case 'localTime':
      return <LocalTimeItem />;
    case 'sessionClockTime':
      return <SessionClockTimeItem />;
    case 'trackWetness':
      return <TrackWetnessItem />;
    case 'precipitation':
      return <PrecipitationItem />;
    case 'airTemperature':
      return (
        <AirTemperatureItem unit={settings?.airTemperature?.unit ?? 'Metric'} />
      );
    case 'trackTemperature':
      return (
        <TrackTemperatureItem
          unit={settings?.trackTemperature?.unit ?? 'Metric'}
        />
      );
    case 'trackName':
      return <TrackNameItem />;
    case 'wind':
      return <WindItem settings={settings?.wind} />;
    case 'humidity':
      return <HumidityItem />;
    case 'driverBadge':
      return <DriverBadgeItem settings={settings?.driverBadge} />;
    case 'sof':
      return <SofItem />;
    case 'classDrivers':
      return <ClassDriversItem />;
    default:
      return null;
  }
};

export const SessionBar = memo(
  ({
    settings: effectiveBarSettings,
    position = 'header',
    opacity = 70,
    standalone = false,
  }: SessionBarProps) => {
    const generalSettings = useGeneralSettings();

    const isUltra = generalSettings?.compactMode === 'ultra';
    const isCompact = generalSettings?.compactMode === 'compact';

    const pyClass = isUltra ? 'py-0' : isCompact ? 'py-1' : 'py-2';
    const gapClass = isUltra ? 'gap-x-2' : isCompact ? 'gap-x-4' : 'gap-x-6';
    const pxClass = standalone
      ? isUltra
        ? 'px-2'
        : isCompact
          ? 'px-3'
          : 'px-4'
      : isUltra
        ? 'px-1'
        : isCompact
          ? 'px-2'
          : 'px-3';

    const displayOrder =
      effectiveBarSettings?.displayOrder ||
      (position === 'header' ? DEFAULT_HEADER_ORDER : DEFAULT_FOOTER_ORDER);

    const enabledKeys = displayOrder.filter((key) =>
      isItemEnabled(key, effectiveBarSettings, position)
    );

    return (
      <div
        className={`${pxClass} ${pyClass} bg-slate-900/(--fg-opacity) flex items-center text-sm ${standalone ? `w-full justify-between ${gapClass}` : 'justify-between'} ${!isCompact && !isUltra && !standalone ? (position === 'header' ? 'mb-3' : 'mt-3') : ''}`}
        style={{
          ['--fg-opacity' as string]: `${opacity}%`,
        }}
      >
        {enabledKeys.map((key, index) => {
          const node = renderItem(key, effectiveBarSettings);
          if (!node) return null;

          if (standalone) {
            const isFirst = index === 0;
            const isLast = index === enabledKeys.length - 1;
            return (
              <div
                key={key}
                className={`whitespace-nowrap shrink-0 ${isFirst ? 'text-left' : isLast ? 'text-right' : 'text-center'}`}
              >
                {node}
              </div>
            );
          }

          return (
            <div key={key} className="whitespace-nowrap">
              {node}
            </div>
          );
        })}
      </div>
    );
  }
);
SessionBar.displayName = 'SessionBar';
