import type {
  SessionData,
  SessionResultsPosition,
  SessionQualifyPosition,
  SessionInfo as SdkSessionInfo,
  Driver as SdkDriver,
  CarSetupInfo,
} from '../app/irsdk/types';
import type { Sector } from '../app/irsdk/types/split-info';

export type Session = SessionData;
export type SessionInfo = SdkSessionInfo;
export type SessionResults = SessionResultsPosition;
export type { SessionQualifyPosition };
export type Driver = SdkDriver;
export type { CarSetupInfo };
export type { Sector };
