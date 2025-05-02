export interface Sector {
    SectorNum: number;
    /** 0 - 1 range; 50% is 0.5 */
    SectorStartPct: number;
}

export interface SplitTimeInfo {
  Sectors: Sector[];
}
