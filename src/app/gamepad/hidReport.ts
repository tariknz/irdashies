/**
 * Pure helpers for locating button bits inside a WebHID device's input reports
 * and detecting button-press edges. Kept free of DOM/Electron so it can be unit
 * tested directly. The renderer host (src/hidHost.ts) wires these to live
 * `navigator.hid` devices.
 *
 * HID input reports are bit-packed: each report item occupies
 * `reportSize * reportCount` bits, laid out sequentially (LSB-first within each
 * byte). Buttons live on the Button usage page (0x09) as 1-bit fields; axes,
 * hats and padding live on other pages / wider fields. By walking every item and
 * advancing a bit cursor we can pick out just the button bits and ignore the
 * rest — so a wheel base's many analog axes never masquerade as button presses.
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

/**
 * Walk a device's input reports and return the bit location of every button,
 * indexed in declaration order.
 */
export function parseButtons(
  collections: readonly HIDCollectionInfo[]
): ButtonBit[] {
  const buttons: ButtonBit[] = [];
  let index = 0;

  for (const report of collectInputReports(collections)) {
    const reportId = report.reportId ?? 0;
    let bit = 0;

    for (const item of report.items ?? []) {
      const size = item.reportSize ?? 0;
      const count = item.reportCount ?? 0;

      if (item.usagePage === BUTTON_USAGE_PAGE && size === 1) {
        for (let k = 0; k < count; k++) {
          const position = bit + k;
          buttons.push({
            reportId,
            byteOffset: position >> 3,
            bitMask: 1 << (position & 7),
            index: index++,
          });
        }
      }

      // Advance past this item regardless of type so offsets stay aligned.
      bit += size * count;
    }
  }

  return buttons;
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
