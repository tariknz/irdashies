import type {
  SessionData,
  SessionResultsPosition,
  SessionInfo as SdkSessionInfo,
  Driver as SdkDriver,
} from '../app/irsdk/types';

export type Session = SessionData & {
  QualifyResultsInfo?: { Results: SessionResultsPosition[] };
};

export type SessionInfo = SdkSessionInfo;
export type SessionResults = SessionResultsPosition;
export type Driver = SdkDriver;
