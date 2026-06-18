// Minimal ambient declarations for the WebHID API. Chromium implements WebHID
// (Electron's renderer) but TypeScript's bundled lib.dom does not ship its
// types, and we don't want to add @types/w3c-web-hid just for this. Only the
// surface used by src/hidHost.ts and src/app/gamepad/hidReport.ts is declared.

interface HIDReportItem {
  reportSize?: number;
  reportCount?: number;
  usagePage?: number;
  usageMinimum?: number;
  usageMaximum?: number;
  isAbsolute?: boolean;
  isConstant?: boolean;
}

interface HIDReportInfo {
  reportId?: number;
  items?: HIDReportItem[];
}

interface HIDCollectionInfo {
  usagePage?: number;
  usage?: number;
  type?: number;
  children?: HIDCollectionInfo[];
  inputReports?: HIDReportInfo[];
  outputReports?: HIDReportInfo[];
  featureReports?: HIDReportInfo[];
}

interface HIDInputReportEvent {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDConnectionEvent {
  readonly device: HIDDevice;
}

interface HIDDevice {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[];
  open(): Promise<void>;
  close(): Promise<void>;
  addEventListener(
    type: 'inputreport',
    listener: (event: HIDInputReportEvent) => void
  ): void;
  removeEventListener(
    type: 'inputreport',
    listener: (event: HIDInputReportEvent) => void
  ): void;
}

interface HID {
  getDevices(): Promise<HIDDevice[]>;
  addEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: HIDConnectionEvent) => void
  ): void;
  removeEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: HIDConnectionEvent) => void
  ): void;
}

interface Navigator {
  readonly hid: HID;
}
