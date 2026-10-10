import type { Standings } from '@irdashies/domain';
import type { NameFormat } from '@irdashies/types';
import { getTailwindStyle } from '@irdashies/utils/colors';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../shared/DriverName/DriverName';

export const classColor = (color: number) =>
  getTailwindStyle(color, undefined, true).classHeader;

export const driverName = (standing: Standings, format: NameFormat) =>
  formatDriverName(extractDriverName(standing.driver.name), format);
