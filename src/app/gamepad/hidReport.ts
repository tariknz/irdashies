/**
 * Pure helpers for locating button bits inside a WebHID device's input reports
 * and detecting button-press edges. Kept free of DOM/Electron so it can be unit
 * tested directly. The renderer host (src/hidHost.ts) wires these to live
 * `navigator.hid` devices.
 *
 * HID input reports are bit-packed: each report item occupies
 * `reportSize * reportCount` bits, laid out sequentially (LSB-first within each
 * byte). Buttons are 1-bit fields; axes, hats and padding are wider or constant.
 * By walking every item and advancing a bit cursor we can pick out just the
 * button bits and ignore the rest — so a wheel base's analog axes never
 * masquerade as button presses.
 */

/** Usage page for buttons in the HID spec. */
const BUTTON_USAGE_PAGE = 0x09;

/** Location of a single button bit within a device's input report. */
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

/** A single 1-bit field located in a report, with the metadata used to pick buttons. */
interface BitField {
  reportId: number;
  byteOffset: number;
  bitMask: number;
  usagePage: number;
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
            usagePage: item.usagePage ?? 0,
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
 * Locate every button in a device's input reports, indexed in declaration order.
 *
 * Buttons on the HID Button usage page (0x09) are preferred. Some controllers
 * and most sim wheel bases declare their buttons on a vendor-defined usage page
 * instead; when no 0x09 buttons exist we fall back to every non-constant 1-bit
 * field (axes are multi-bit, padding is constant, so neither is mistaken for a
 * button).
 */
export function parseButtons(
  collections: readonly HIDCollectionInfo[]
): ButtonBit[] {
  const fields = collectBitFields(collections);

  let chosen = fields.filter((f) => f.usagePage === BUTTON_USAGE_PAGE);
  if (chosen.length === 0) {
    chosen = fields.filter((f) => !f.isConstant);
  }

  return chosen.map((field, index) => ({
    reportId: field.reportId,
    byteOffset: field.byteOffset,
    bitMask: field.bitMask,
    index,
  }));
}

/**
 * Read button states from an input report and return the indices that
 * transitioned from up to down (rising edge). `state` is mutated in place to
 * hold the latest pressed/released value for each button index.
 */
export function buttonEdges(
  data: DataView,
  buttons: readonly ButtonBit[],
  reportId: number,
  state: Map<number, boolean>
): number[] {
  const pressed: number[] = [];

  for (const button of buttons) {
    if (button.reportId !== reportId) continue;
    if (button.byteOffset >= data.byteLength) continue;

    const isDown = (data.getUint8(button.byteOffset) & button.bitMask) !== 0;
    if (isDown && !(state.get(button.index) ?? false)) {
      pressed.push(button.index);
    }
    state.set(button.index, isDown);
  }

  return pressed;
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
        `    usagePage=${hex(item.usagePage ?? 0)} ` +
          `usages=${item.usageMinimum ?? '?'}..${item.usageMaximum ?? '?'} ` +
          `size=${item.reportSize ?? 0}x${item.reportCount ?? 0} ` +
          `const=${item.isConstant ?? false}`
      );
    }
  }

  return lines.join('\n') || '  (no input reports)';
}
