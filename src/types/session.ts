import type {
  SessionData,
  SessionResultsPosition,
  SessionQualifyPosition,
  SessionInfo as SdkSessionInfo,
  Driver as SdkDriver,
  CarSetupInfo,
  LmuTrackMap,
} from '../app/irsdk/types';
import type { CameraInfo, CameraGroup } from '../app/irsdk/types/camera-info';
import type { Sector } from '../app/irsdk/types/split-info';

export type Session = SessionData;
export type SessionInfo = SdkSessionInfo;
export type SessionResults = SessionResultsPosition;
export type { SessionQualifyPosition };
export type Driver = SdkDriver;
export type { CarSetupInfo };
export type { Sector };
export type { CameraInfo, CameraGroup };
export type { LmuTrackMap };
