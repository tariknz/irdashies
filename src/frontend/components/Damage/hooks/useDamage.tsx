import { useMemo } from 'react';
import {
  useCarConditionSnapshot,
  useDriverControlsSnapshot,
} from '@irdashies/context';
import type { DamageSnapshot } from '../logic';

const positive = (value: number | undefined) =>
  value !== undefined && value > 0 ? value : undefined;

export const useDamage = (): DamageSnapshot => {
  const car = useCarConditionSnapshot();
  const controls = useDriverControlsSnapshot();
  return useMemo(
    () => ({
      dentSeverity: car?.dentSeverity ? [...car.dentSeverity] : [],
      wheelDetached: car?.wheelDetached?.length
        ? [...car.wheelDetached]
        : [false, false, false, false],
      suspensionDamage: car?.suspensionDamage ? [...car.suspensionDamage] : [],
      tyreWear: car?.tyreWear?.length
        ? car.tyreWear.map((value) => value ?? Number.NaN)
        : [],
      tyrePressure: car?.tyrePressure?.length
        ? car.tyrePressure.map((value) => value ?? Number.NaN)
        : [],
      aeroDamage: car?.aeroDamage,
      repairTime: positive(car?.lmuRepairTime) ?? positive(car?.pitRepairLeft),
      optRepairTime: positive(car?.pitOptRepairLeft),
      repairNeeded: car?.repairNeeded === true,
      optRepairNeeded: car?.optRepairNeeded === true,
      bodyDetached: car?.bodyDetached === true,
      engineWarnings: controls?.engineWarnings ?? 0,
    }),
    [car, controls?.engineWarnings]
  );
};
