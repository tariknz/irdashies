import type {
  SessionData,
  SessionResultsPosition,
  SessionInfo as SdkSessionInfo,
  Driver as SdkDriver,
  CarSetupInfo,
} from '../app/irsdk/types';

export type Session = SessionData;
export type SessionInfo = SdkSessionInfo;
export type SessionResults = SessionResultsPosition;
export type Driver = SdkDriver;
export type { CarSetupInfo };
