/**
 * Pure helpers for locating button bits inside a WebHID device's input reports
 * and detecting button-press edges. Kept free of DOM/Electron so it can be unit
 * tested directly. The renderer host (src/hidHost.ts) wires these to live
 * `navigator.hid` devices.
 *
 * HID input reports are bit-packed: each report item occupies
 * `reportSize * reportCount` bits, laid out sequentially (LSB-first within each
 * byte). Buttons are 1-bit fields; hat switches (d-pads) are a small multi-bit
 * value handled separately (see parseHats); axes and padding are wider or
 * constant and ignored. By walking every item and advancing a bit cursor we can
 * pick out just the controls we want — so a wheel base's analog axes never
 * masquerade as button presses.
 */

import {
  HAT_DIRECTIONS,
  type ButtonBit,
  type HatDirection,
  type HatField,
  type HatPress,
} from '@irdashies/types';

/**
 * A HID usage value packs a 16-bit usage page in the high half and a 16-bit
 * usage id in the low half (WebHID surfaces only this combined value).
 */
const USAGE_PAGE_SHIFT = 16;
const USAGE_ID_MASK = 0xffff;

/** Usage pages and the usages within them that this parser recognises. */
const HID_USAGE = {
  /** Generic Desktop page. */
  GENERIC_DESKTOP_PAGE: 0x01,
  /** Hat Switch usage id, on the Generic Desktop page. */
  HAT_SWITCH: 0x39,
} as const;

/**
 * The 32-bit usage value of a report item: usage page in the high 16 bits,
 * usage id in the low 16. WebHID has no separate `usagePage` field.
 *
 * `isRange` selects where the usages live: range items (e.g. Button 1..N) use
 * `usageMinimum`/`usageMaximum`, enumerated items use the `usages` array. Read
 * whichever the item declares — for an enumerated item `usageMinimum` may be
 * surfaced as 0, so it must not be trusted as the source.
 */
function itemUsage(item: HIDReportItem): number {
  const usage = item.isRange
    ? (item.usageMinimum ?? item.usages?.[0])
    : (item.usages?.[0] ?? item.usageMinimum);
  return usage ?? 0;
}

/** Usage page (high 16 bits) of a report item. Used for diagnostics and hat detection. */
export function itemUsagePage(item: HIDReportItem): number {
  return itemUsage(item) >>> USAGE_PAGE_SHIFT;
}

/** A single 1-bit field located in a report. Constant fields are padding. */
interface BitField {
  reportId: number;
  byteOffset: number;
  bitMask: number;
  isConstant: boolean;
}

/** Flatten a collection tree into its input reports (reports can nest in children). */
function collectInputReports(
  collections: readonly HIDCollectionInfo[]
): HIDReportInfo[] {
  const reports: HIDReportInfo[] = [];
  for (const collection of collections) {
    if (collection.inputReports) reports.push(...collection.inputReports);
    if (collection.children) {
      reports.push(...collectInputReports(collection.children));
    }
  }
  return reports;
}

/** Walk every input-report item and record the bit location of each 1-bit field. */
function collectBitFields(
  collections: readonly HIDCollectionInfo[]
): BitField[] {
  const fields: BitField[] = [];

  for (const report of collectInputReports(collections)) {
    const reportId = report.reportId ?? 0;
    let bit = 0;

    for (const item of report.items ?? []) {
      const size = item.reportSize ?? 0;
      const count = item.reportCount ?? 0;

      if (size === 1) {
        for (let k = 0; k < count; k++) {
          const position = bit + k;
          fields.push({
            reportId,
            byteOffset: position >> 3,
            bitMask: 1 << (position & 7),
            isConstant: item.isConstant ?? false,
          });
        }
      }

      // Advance past this item regardless of type so offsets stay aligned.
      bit += size * count;
    }
  }

  return fields;
}

/**
 * Locate every bindable control in a device's input reports, indexed in
 * declaration order.
 *
 * A bindable control is any non-constant single-bit field. Analog axes are
 * multi-bit (reportSize > 1) so they never appear here; constant fields are
 * padding. We deliberately do NOT filter by usage page — many controllers and
 * sim wheel bases (e.g. Thrustmaster) declare their buttons on vendor-defined
 * pages, and an unbound bit triggers nothing (GamepadManager only fires mapped
 * tokens), so there is no need to guess which 1-bit fields are "real" buttons.
 */
export function parseButtons(
  collections: readonly HIDCollectionInfo[]
): ButtonBit[] {
  const fields = collectBitFields(collections).filter((f) => !f.isConstant);

  return fields.map((field, index) => ({
    reportId: field.reportId,
    byteOffset: field.byteOffset,
    bitMask: field.bitMask,
    index,
  }));
}

/**
 * Locate every hat switch (d-pad / point-of-view) in a device's input reports.
 *
 * A hat is the Hat Switch usage (0x39) on the Generic Desktop page, declared as
 * a small multi-bit value (almost always 4 bits) rather than individual bits —
 * which is exactly why {@link parseButtons} never sees a d-pad. We walk the same
 * bit cursor as collectBitFields so the offset lines up with the live report.
 */
export function parseHats(
  collections: readonly HIDCollectionInfo[]
): HatField[] {
  const hats: HatField[] = [];
  let index = 0;

  for (const report of collectInputReports(collections)) {
    const reportId = report.reportId ?? 0;
    let bit = 0;

    for (const item of report.items ?? []) {
      const size = item.reportSize ?? 0;
      const count = item.reportCount ?? 0;
      const usage = itemUsage(item);
      const isHat =
        usage >>> USAGE_PAGE_SHIFT === HID_USAGE.GENERIC_DESKTOP_PAGE &&
        (usage & USAGE_ID_MASK) === HID_USAGE.HAT_SWITCH;

      if (isHat && size >= 2 && size <= 8) {
        // Pads number their hat 0-7 or 1-8; the descriptor's logical range tells
        // us which, and which raw value means "up".
        const logicalMin = item.logicalMinimum ?? 0;
        const logicalMax =
          item.logicalMaximum ?? logicalMin + HAT_DIRECTIONS.length - 1;
        for (let k = 0; k < count; k++) {
          hats.push({
            reportId,
            bitOffset: bit + k * size,
            bitWidth: size,
            logicalMin,
            logicalMax,
            index: index++,
          });
        }
      }

      bit += size * count;
    }
  }

  return hats;
}

/** A button that transitioned this report: `down: true` on press, `false` on release. */
export interface ButtonChange {
  index: number;
  down: boolean;
}

/**
 * Read button states from an input report and return every button that
 * transitioned (pressed or released) this report. Combo (chord) bindings need
 * both edges to know which buttons are still held alongside a newly-pressed
 * one. `state` is mutated in place to hold the latest pressed/released value
 * for each button index.
 */
export function buttonChanges(
  data: DataView,
  buttons: readonly ButtonBit[],
  reportId: number,
  state: Map<number, boolean>
): ButtonChange[] {
  const changes: ButtonChange[] = [];

  for (const button of buttons) {
    if (button.reportId !== reportId) continue;
    if (button.byteOffset >= data.byteLength) continue;

    const isDown = (data.getUint8(button.byteOffset) & button.bitMask) !== 0;
    const wasDown = state.get(button.index) ?? false;
    if (isDown !== wasDown) {
      changes.push({ index: button.index, down: isDown });
    }
    state.set(button.index, isDown);
  }

  return changes;
}

/** Read `bitWidth` bits starting at `bitOffset` (LSB-first), or null if out of range. */
function readBits(
  data: DataView,
  bitOffset: number,
  bitWidth: number
): number | null {
  let value = 0;
  for (let i = 0; i < bitWidth; i++) {
    const position = bitOffset + i;
    const byteOffset = position >> 3;
    if (byteOffset >= data.byteLength) return null;
    value |= ((data.getUint8(byteOffset) >> (position & 7)) & 1) << i;
  }
  return value;
}

/** A hat direction that transitioned this report: released, pressed, or both (rolling to a new direction). */
export interface HatChange extends HatPress {
  down: boolean;
}

/**
 * Read hat values from an input report and return every direction transition
 * this report: holding fires nothing further, rolling straight from one
 * direction to another fires a release of the old one followed by a press of
 * the new one (same report, two entries), and centering (value outside the
 * logical range) fires a release with no matching press. `state` is mutated
 * in place. Releases let a d-pad direction be tracked as held, same as a
 * button, so it can be a combo (chord) member.
 */
export function hatChanges(
  data: DataView,
  hats: readonly HatField[],
  reportId: number,
  state: Map<number, HatDirection | null>
): HatChange[] {
  const changes: HatChange[] = [];

  for (const hat of hats) {
    if (hat.reportId !== reportId) continue;

    const value = readBits(data, hat.bitOffset, hat.bitWidth);
    // Directions run from logicalMin (= up) clockwise; a value outside the
    // [logicalMin, logicalMax] range (commonly 0, 8 or 15) means centered.
    const offset = value === null ? -1 : value - hat.logicalMin;
    const direction =
      value !== null &&
      value >= hat.logicalMin &&
      value <= hat.logicalMax &&
      offset < HAT_DIRECTIONS.length
        ? HAT_DIRECTIONS[offset]
        : null;
    const previous = state.get(hat.index) ?? null;

    if (direction !== previous) {
      if (previous)
        changes.push({ index: hat.index, direction: previous, down: false });
      if (direction) changes.push({ index: hat.index, direction, down: true });
    }
    state.set(hat.index, direction);
  }

  return changes;
}

/** Human-readable dump of a device's input-report layout, for diagnostics. */
export function describeCollections(
  collections: readonly HIDCollectionInfo[]
): string {
  const hex = (n: number) => `0x${n.toString(16).padStart(2, '0')}`;
  const lines: string[] = [];

  for (const report of collectInputReports(collections)) {
    lines.push(`  report id=${report.reportId ?? 0}`);
    for (const item of report.items ?? []) {
      lines.push(
        `    usagePage=${hex(itemUsagePage(item))} ` +
          `usages=${item.usageMinimum ?? '?'}..${item.usageMaximum ?? '?'} ` +
          `size=${item.reportSize ?? 0}x${item.reportCount ?? 0} ` +
          `const=${item.isConstant ?? false}`
      );
    }
  }

  return lines.join('\n') || '  (no input reports)';
}
