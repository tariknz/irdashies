export interface RadioFrequency {
  FrequencyNum: number;
  FrequencyName: string;
  Priority: number;
  CarIdx: number;
  EntryIdx: number;
  ClubID: number;
  CanScan: number; // bool?
  CanSquawk: number; // bool?
  Muted: number; // bool?
  IsMutable: number; // bool?
  IsDeletable: number; // bool?
}

export interface Radio {
  RadioNum: number;
  HopCount: number;
  NumFrequencies: number;
  TunedToFrequencyNum: number;
  ScanningIsOn: number; // bool?
  Frequencies: RadioFrequency[];
}

export interface RadioInfo {
  SelectedRadioNum: number;
  Radios: Radio[];
}
