/** Parsed device + control parts of a gamepad token. */
export interface ParsedGamepadToken {
  /** Decoded device product name, or undefined when the token carries none. */
  device?: string;
  /** Control id, e.g. "btn5" or "hat0_up". */
  button: string;
}

/** Location of a single button bit within a device's HID input report. */
export interface ButtonBit {
  /** Report ID the bit belongs to (0 when the device uses no report IDs). */
  reportId: number;
  /** Byte offset within the report's data (the report-ID prefix is excluded). */
  byteOffset: number;
  /** Bit mask within that byte. */
  bitMask: number;
  /** Stable zero-based ordinal across all of the device's buttons. */
  index: number;
}

/**
 * The eight hat (point-of-view / d-pad) positions in HID order: value 0 is up,
 * incrementing clockwise. Any value outside 0-7 means the hat is centered.
 */
export const HAT_DIRECTIONS = [
  'up',
  'upright',
  'right',
  'downright',
  'down',
  'downleft',
  'left',
  'upleft',
] as const;

export type HatDirection = (typeof HAT_DIRECTIONS)[number];

/** Location of a hat-switch (d-pad / POV) value within a device's HID input report. */
export interface HatField {
  reportId: number;
  /** Absolute bit offset of the value within the report's data. */
  bitOffset: number;
  /** Width of the value in bits (typically 4). */
  bitWidth: number;
  /** Raw value of the first ("up") position. Pads number 0-7 or 1-8. */
  logicalMin: number;
  /** Raw value of the last valid position; anything outside the range is centered. */
  logicalMax: number;
  /** Stable zero-based ordinal across all of the device's hats. */
  index: number;
}

/** A hat that just entered a new direction — the d-pad equivalent of a press. */
export interface HatPress {
  index: number;
  direction: HatDirection;
}
