import { useGeneralSettings } from '@irdashies/context';
import { SessionBar } from '../Standings/components/SessionBar/SessionBar';
import { useInformationBarSettings } from '../Standings/hooks';

export const InformationBar = () => {
  const settings = useInformationBarSettings();
  const generalSettings = useGeneralSettings();

  if (!settings?.enabled) {
    return null;
  }

  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';

  return (
    <div
      className={`w-full bg-slate-800/(--bg-opacity) rounded-sm ${!isCompact ? 'p-2' : ''} overflow-hidden pointer-events-none`}
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 60}%`,
      }}
    >
      <SessionBar settings={settings} standalone />
    </div>
  );
};

InformationBar.displayName = 'InformationBar';
