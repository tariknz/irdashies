import { RadioInfo } from './radio-info';
import { CameraInfo } from './camera-info';
import { SessionList } from './session-info';
import { WeekendInfo } from './weekend-info';
import { DriverInfo } from './driver-info';
import { SplitTimeInfo } from './split-info';
import { CarSetupInfo } from './setup-info';

/**
 * Information about the current session, stored as yaml.
 * Does not update as much as telemetry.
 * @todo the CarSetup types are incomplete. Help wanted!
 */
export interface SessionData {
  WeekendInfo: WeekendInfo;
  SessionInfo: SessionList;
  CameraInfo: CameraInfo;
  RadioInfo: RadioInfo;
  DriverInfo: DriverInfo;
  SplitTimeInfo: SplitTimeInfo;
  CarSetup: CarSetupInfo;
}
