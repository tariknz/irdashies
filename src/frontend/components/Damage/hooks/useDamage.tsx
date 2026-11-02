import {
  useDriverControlsSnapshot,
  useTelemetryValue,
  useTelemetryValueRounded,
  useTelemetryValues,
  useTelemetryValuesRounded,
} from '@irdashies/context';
import type { DamageSnapshot } from '../logic';

export const useDamage = (): DamageSnapshot => {
  const dentSeverity = useTelemetryValues('LmuDentSeverity');
  const wheelDetached = useTelemetryValues<boolean[]>('LmuWheelDetached');
  const suspensionDamage = useTelemetryValuesRounded('LmuSuspensionDamage', 3);
  const aeroDamage = useTelemetryValueRounded('LmuAeroDamage', 3);
  const lmuRepair = useTelemetryValueRounded('LmuRepairTime', 1);
  const pitRepair = useTelemetryValueRounded('PitRepairLeft', 1);
  const pitOptRepair = useTelemetryValueRounded('PitOptRepairLeft', 1);
  const repairNeeded = useTelemetryValue<boolean>('PitRepairNeeded');
  const optRepairNeeded = useTelemetryValue<boolean>('PitOptRepairNeeded');
  const controls = useDriverControlsSnapshot();
  const tyreWear = controls?.tyreWear;

  const repairTime =
    lmuRepair !== undefined && lmuRepair > 0
      ? lmuRepair
      : pitRepair !== undefined && pitRepair > 0
        ? pitRepair
        : undefined;

  return {
    dentSeverity: dentSeverity.length ? [...dentSeverity] : [],
    wheelDetached: wheelDetached.length
      ? [...wheelDetached]
      : [false, false, false, false],
    suspensionDamage: suspensionDamage.length ? [...suspensionDamage] : [],
    tyreWear: tyreWear?.length ? [...tyreWear] : [],
    aeroDamage,
    repairTime,
    optRepairTime:
      pitOptRepair !== undefined && pitOptRepair > 0 ? pitOptRepair : undefined,
    repairNeeded: !!repairNeeded,
    optRepairNeeded: !!optRepairNeeded,
  };
};
