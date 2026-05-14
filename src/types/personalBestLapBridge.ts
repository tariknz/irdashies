export interface PersonalBestLapBridge {
  getPersonalBest: (trackId: string | number, carName: string) => Promise<number | null>;
  setPersonalBest: (
    trackId: string | number,
    carName: string,
    time: number,
    lapNumber?: number
  ) => Promise<void>;
}
