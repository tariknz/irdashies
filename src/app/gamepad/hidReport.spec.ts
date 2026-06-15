import { describe, it, expect } from 'vitest';
import { parseButtons, buttonEdges, type ButtonBit } from './hidReport';

/** Build a collections tree from input-report item lists (one report each). */
const collections = (
  ...reports: { reportId?: number; items: Partial<HIDReportItem>[] }[]
): HIDCollectionInfo[] =>
  [
    {
      inputReports: reports.map((r) => ({
        reportId: r.reportId,
        items: r.items,
      })),
    },
  ] as unknown as HIDCollectionInfo[];

const view = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe('parseButtons', () => {
  it('locates a simple block of buttons at byte 0', () => {
    const buttons = parseButtons(
      collections({
        items: [{ usagePage: 0x09, reportSize: 1, reportCount: 8 }],
      })
    );

    expect(buttons).toHaveLength(8);
    expect(buttons[0]).toEqual({
      reportId: 0,
      byteOffset: 0,
      bitMask: 0b00000001,
      index: 0,
    });
    expect(buttons[5]).toEqual({
      reportId: 0,
      byteOffset: 0,
      bitMask: 0b00100000,
      index: 5,
    });
  });

  it('skips axis fields and keeps the button bit offsets aligned', () => {
    // 8-bit axis, then 8 buttons -> buttons start at bit 8 (byte 1).
    const buttons = parseButtons(
      collections({
        items: [
          { usagePage: 0x01, reportSize: 8, reportCount: 1 }, // X axis
          { usagePage: 0x09, reportSize: 1, reportCount: 8 },
        ],
      })
    );

    expect(buttons).toHaveLength(8);
    expect(buttons[0]).toMatchObject({ byteOffset: 1, bitMask: 0b1 });
    expect(buttons[7]).toMatchObject({ byteOffset: 1, bitMask: 0b10000000 });
  });

  it('ignores wide (non-1-bit) fields on the button page', () => {
    // A hat switch is reported on the button page in some descriptors but as a
    // multi-bit field; only true 1-bit buttons are captured.
    const buttons = parseButtons(
      collections({
        items: [{ usagePage: 0x09, reportSize: 4, reportCount: 1 }],
      })
    );
    expect(buttons).toHaveLength(0);
  });

  it('falls back to non-constant 1-bit fields when no 0x09 buttons exist', () => {
    // Wheel bases often declare buttons on a vendor-defined usage page.
    const buttons = parseButtons(
      collections({
        items: [
          {
            usagePage: 0xff00,
            reportSize: 1,
            reportCount: 6,
            isConstant: false,
          },
          { usagePage: 0x01, reportSize: 8, reportCount: 2 }, // axes
        ],
      })
    );

    expect(buttons).toHaveLength(6);
    expect(buttons[0]).toMatchObject({ byteOffset: 0, bitMask: 0b1, index: 0 });
  });

  it('excludes constant padding from the fallback', () => {
    const buttons = parseButtons(
      collections({
        items: [
          {
            usagePage: 0xff00,
            reportSize: 1,
            reportCount: 4,
            isConstant: false,
          },
          { usagePage: 0x00, reportSize: 1, reportCount: 4, isConstant: true }, // padding
        ],
      })
    );
    expect(buttons).toHaveLength(4);
  });

  it('indexes buttons continuously across multiple reports', () => {
    const buttons = parseButtons(
      collections(
        {
          reportId: 1,
          items: [{ usagePage: 0x09, reportSize: 1, reportCount: 4 }],
        },
        {
          reportId: 2,
          items: [{ usagePage: 0x09, reportSize: 1, reportCount: 4 }],
        }
      )
    );

    expect(buttons.map((b) => b.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(buttons[0].reportId).toBe(1);
    expect(buttons[4].reportId).toBe(2);
  });
});

describe('buttonEdges', () => {
  const buttons: ButtonBit[] = [
    { reportId: 0, byteOffset: 0, bitMask: 0b001, index: 0 },
    { reportId: 0, byteOffset: 0, bitMask: 0b010, index: 1 },
    { reportId: 0, byteOffset: 0, bitMask: 0b100, index: 2 },
  ];

  it('reports a press once on the rising edge, ignoring held frames', () => {
    const state = new Map<number, boolean>();

    expect(buttonEdges(view(0b000), buttons, 0, state)).toEqual([]);
    expect(buttonEdges(view(0b101), buttons, 0, state)).toEqual([0, 2]);
    // Held: no new edges.
    expect(buttonEdges(view(0b101), buttons, 0, state)).toEqual([]);
    // Release then press again -> new edge.
    expect(buttonEdges(view(0b000), buttons, 0, state)).toEqual([]);
    expect(buttonEdges(view(0b001), buttons, 0, state)).toEqual([0]);
  });

  it('only reads buttons whose reportId matches the incoming report', () => {
    const state = new Map<number, boolean>();
    const idBtns: ButtonBit[] = [
      { reportId: 1, byteOffset: 0, bitMask: 0b1, index: 0 },
      { reportId: 2, byteOffset: 0, bitMask: 0b1, index: 1 },
    ];

    // A report with id 2 must not read the id-1 button's bits.
    expect(buttonEdges(view(0b1), idBtns, 2, state)).toEqual([1]);
    expect(state.has(0)).toBe(false);
  });

  it('guards against a byte offset past the end of the report', () => {
    const state = new Map<number, boolean>();
    const wide: ButtonBit[] = [
      { reportId: 0, byteOffset: 4, bitMask: 0b1, index: 0 },
    ];
    expect(buttonEdges(view(0b1), wide, 0, state)).toEqual([]);
  });
});
