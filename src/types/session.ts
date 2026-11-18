import type {
  SessionData,
  SessionResultsPosition,
  SessionQualifyPosition,
  SessionInfo as SdkSessionInfo,
  Driver as SdkDriver,
  CarSetupInfo,
  LmuTrackMap,
  LmuRestSession,
  LmuWeatherNode,
} from './irSdk';
import type { CameraInfo, CameraGroup } from './irSdk/camera-info';
import type { Sector } from './irSdk/split-info';

export type Session = SessionData;
export type SessionInfo = SdkSessionInfo;
export type SessionResults = SessionResultsPosition;
export type { SessionQualifyPosition };
export type Driver = SdkDriver;
export type { CarSetupInfo };
export type { Sector };
export type { CameraInfo, CameraGroup };
export type { LmuTrackMap };
export type { LmuRestSession, LmuWeatherNode };
