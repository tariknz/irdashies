import {
  useActiveSimulator,
  useDashboard,
  useDemoFrame,
  useSessionVisibility,
  trackStateSelectors,
  useTrackStateSelector,
} from '@irdashies/context';
import { DamageDisplay, LMU_WARNING_ICONS } from './components/DamageDisplay';
import { useDamage } from './hooks/useDamage';
import { useDamageCar } from './hooks/useDamageCar';
import { useDamageSettings } from './hooks/useDamageSettings';
import { getDemoDamage, hasCarDamage } from './logic';

export const Damage = () => {
  const { isDemoMode } = useDashboard();
  const simulator = useActiveSimulator();
  const settings = useDamageSettings();
  const live = useDamage();
  const car = useDamageCar();
  const isOnTrack = useTrackStateSelector(trackStateSelectors.isOnTrack);
  const sessionVisible = useSessionVisibility(settings.sessionVisibility);
  const demo = useDemoFrame(isDemoMode, getDemoDamage);
  const data = isDemoMode && demo ? demo : live;

  if (!isDemoMode && !sessionVisible) return null;
  if (!isDemoMode && settings.showOnlyWhenOnTrack && !isOnTrack) return null;
  if (!isDemoMode && settings.showOnlyWhenDamaged && !hasCarDamage(data)) {
    return null;
  }

  return (
    <DamageDisplay
      data={data}
      opacity={settings.background.opacity}
      showIntegrity={settings.showIntegrity}
      showStats={settings.showStats}
      showTyreWear={settings.showTyreWear}
      showCornerBadges={settings.showCornerBadges}
      showCornerPct={settings.showCornerPct}
      bodyStyle={isDemoMode ? 'gtMid' : car.bodyStyle}
      warningIcons={
        !isDemoMode && simulator === 'lmu' ? LMU_WARNING_ICONS : undefined
      }
    />
  );
};
