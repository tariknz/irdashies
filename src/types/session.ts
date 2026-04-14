import type {
  SessionData,
  SessionResultsPosition,
  SessionQualifyPosition,
  SessionInfo as SdkSessionInfo,
  Driver as SdkDriver,
  CarSetupInfo,
} from '../app/irsdk/types';

export type Session = SessionData;
export type SessionInfo = SdkSessionInfo;
export type SessionResults = SessionResultsPosition;
export type { SessionQualifyPosition };
export type Driver = SdkDriver;
export type { CarSetupInfo };

export interface CarClassStats {
  shortName: string;
  color: number;
  total: number;
  sof: number;
}
