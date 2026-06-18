import { describe, it, expect } from 'vitest';
import type { ButtonBit, HatField, HatDirection } from '@irdashies/types';
import {
  parseButtons,
  parseHats,
  buttonEdges,
  hatEdges,
  itemUsagePage,
} from './hidReport';

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

/** Encode a HID usage page into the high 16 bits of a usage value, as WebHID reports it. */
const page = (p: number) => p * 0x10000;

describe('parseButtons', () => {
  it('locates a simple block of buttons at byte 0', () => {
    const buttons = parseButtons(
      collections({
        items: [{ usageMinimum: page(0x09), reportSize: 1, reportCount: 8 }],
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
          { usageMinimum: page(0x01), reportSize: 8, reportCount: 1 }, // X axis
          { usageMinimum: page(0x09), reportSize: 1, reportCount: 8 },
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
        items: [{ usageMinimum: page(0x09), reportSize: 4, reportCount: 1 }],
      })
    );
    expect(buttons).toHaveLength(0);
  });

  it('includes single-bit controls on any usage page (Button + Generic Desktop d-pad)', () => {
    // Real buttons on the Button page (0x09) plus a d-pad as four on/off bits on
    // Generic Desktop (0x01, usages 0x90-0x93). Both are single-bit controls, so
    // both are bindable — selection does not filter by usage page.
    const buttons = parseButtons(
      collections({
        items: [
          { usageMinimum: page(0x09) + 1, reportSize: 1, reportCount: 4 },
          {
            usageMinimum: page(0x01) + 0x90, // D-pad Up..Left
            reportSize: 1,
            reportCount: 4,
          },
        ],
      })
    );

    expect(buttons).toHaveLength(8);
  });

  it('collects buttons declared on a vendor-defined usage page', () => {
    // Most sim wheel bases (e.g. Thrustmaster) declare buttons on a vendor page.
    const buttons = parseButtons(
      collections({
        items: [
          {
            usageMinimum: page(0xff00),
            reportSize: 1,
            reportCount: 6,
            isConstant: false,
          },
          { usageMinimum: page(0x01), reportSize: 8, reportCount: 2 }, // axes
        ],
      })
    );

    expect(buttons).toHaveLength(6);
    expect(buttons[0]).toMatchObject({ byteOffset: 0, bitMask: 0b1, index: 0 });
  });

  it('excludes constant padding', () => {
    const buttons = parseButtons(
      collections({
        items: [
          {
            usageMinimum: page(0xff00),
            reportSize: 1,
            reportCount: 4,
            isConstant: false,
          },
          {
            usageMinimum: page(0x00),
            reportSize: 1,
            reportCount: 4,
            isConstant: true,
          }, // padding
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
          items: [{ usageMinimum: page(0x09), reportSize: 1, reportCount: 4 }],
        },
        {
          reportId: 2,
          items: [{ usageMinimum: page(0x09), reportSize: 1, reportCount: 4 }],
        }
      )
    );

    expect(buttons.map((b) => b.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(buttons[0].reportId).toBe(1);
    expect(buttons[4].reportId).toBe(2);
  });
});

// Selection no longer depends on the usage page, but `itemUsagePage` still
// feeds the diagnostic dump (describeCollections), and its derivation is
// non-obvious: WebHID has no `usagePage` field on a report item — the page is
// the high 16 bits of each 32-bit usage value (`usageMinimum` for ranges,
// `usages[]` for enumerated, chosen by `isRange`).
describe('itemUsagePage (diagnostic page derivation)', () => {
  it('reads the page from the high 16 bits of usageMinimum for range items', () => {
    expect(itemUsagePage({ isRange: true, usageMinimum: page(0x09) + 1 })).toBe(
      0x09
    );
    expect(itemUsagePage({ isRange: true, usageMinimum: page(0xff00) })).toBe(
      0xff00
    );
  });

  it('does not confuse a low-word usage id with the page', () => {
    // 0x0009 is page 0x00, usage id 9 — not the Button page.
    expect(itemUsagePage({ isRange: true, usageMinimum: 0x0009 })).toBe(0x00);
  });

  it('reads usages[] for enumerated items, even when usageMinimum is present as 0', () => {
    // isRange false -> the usages live in `usages[]`; Chromium may still surface
    // usageMinimum as 0, which must not be read as page 0.
    expect(
      itemUsagePage({
        isRange: false,
        usages: [page(0x09) + 1],
        usageMinimum: 0,
      })
    ).toBe(0x09);
  });

  it('returns 0 when the item declares no usage', () => {
    expect(itemUsagePage({})).toBe(0);
  });
});

describe('parseHats', () => {
  it('locates a 4-bit hat switch and skips axes and buttons', () => {
    const hats = parseHats(
      collections({
        items: [
          { usageMinimum: page(0x01) + 0x30, reportSize: 16, reportCount: 1 }, // X axis, bits 0-15
          { usageMinimum: page(0x09) + 1, reportSize: 1, reportCount: 8 }, // 8 buttons, bits 16-23
          { usages: [page(0x01) + 0x39], reportSize: 4, reportCount: 1 }, // hat switch, bits 24-27
        ],
      })
    );

    expect(hats).toEqual([
      {
        reportId: 0,
        bitOffset: 24,
        bitWidth: 4,
        logicalMin: 0,
        logicalMax: 7,
        index: 0,
      },
    ]);
  });

  it('captures the declared logical range (e.g. a 1-8 numbered hat)', () => {
    const hats = parseHats(
      collections({
        items: [
          {
            usages: [page(0x01) + 0x39],
            reportSize: 4,
            reportCount: 1,
            logicalMinimum: 1,
            logicalMaximum: 8,
          },
        ],
      })
    );

    expect(hats[0]).toMatchObject({ logicalMin: 1, logicalMax: 8 });
  });

  it('does not treat other Generic Desktop fields as hats', () => {
    // Usage 0x30 (X axis) on the same page is not a hat switch (0x39).
    const hats = parseHats(
      collections({
        items: [
          { usageMinimum: page(0x01) + 0x30, reportSize: 4, reportCount: 1 },
        ],
      })
    );
    expect(hats).toHaveLength(0);
  });
});

describe('hatEdges', () => {
  const hat = (over: Partial<HatField> = {}): HatField => ({
    reportId: 0,
    bitOffset: 0,
    bitWidth: 4,
    logicalMin: 0,
    logicalMax: 7,
    index: 0,
    ...over,
  });
  const hats: HatField[] = [hat()];

  it('fires once on entering a direction, ignoring held frames', () => {
    const state = new Map<number, HatDirection | null>();

    expect(hatEdges(view(0x0f), hats, 0, state)).toEqual([]); // 15 = centered
    expect(hatEdges(view(0x00), hats, 0, state)).toEqual([
      { index: 0, direction: 'up' }, // 0 = up
    ]);
    expect(hatEdges(view(0x00), hats, 0, state)).toEqual([]); // held
    expect(hatEdges(view(0x02), hats, 0, state)).toEqual([
      { index: 0, direction: 'right' }, // roll straight to 2 = right
    ]);
    expect(hatEdges(view(0x0f), hats, 0, state)).toEqual([]); // centered
    expect(hatEdges(view(0x00), hats, 0, state)).toEqual([
      { index: 0, direction: 'up' }, // press again
    ]);
  });

  it('respects a 1-8 numbered hat (logicalMin 1, 0 = centered)', () => {
    // The real bug: a pad whose hat reads 1=up..8=upleft, 0=centered. Without
    // the logicalMin base, raw 1 decoded as "upright" and raw 7 as "upleft".
    const state = new Map<number, HatDirection | null>();
    const oneBased: HatField[] = [hat({ logicalMin: 1, logicalMax: 8 })];

    expect(hatEdges(view(0x00), oneBased, 0, state)).toEqual([]); // 0 = centered
    expect(hatEdges(view(0x01), oneBased, 0, state)).toEqual([
      { index: 0, direction: 'up' }, // 1 = up
    ]);
    expect(hatEdges(view(0x07), oneBased, 0, state)).toEqual([
      { index: 0, direction: 'left' }, // 7 = left
    ]);
    expect(hatEdges(view(0x08), oneBased, 0, state)).toEqual([
      { index: 0, direction: 'upleft' }, // 8 = upleft
    ]);
  });

  it('reads a hat packed in the high nibble (bit offset 4)', () => {
    const state = new Map<number, HatDirection | null>();
    const hi: HatField[] = [hat({ bitOffset: 4 })];
    // high nibble of 0x40 is 4 -> down
    expect(hatEdges(view(0x40), hi, 0, state)).toEqual([
      { index: 0, direction: 'down' },
    ]);
  });

  it('treats values outside the range as centered', () => {
    const state = new Map<number, HatDirection | null>();
    expect(hatEdges(view(0x08), hats, 0, state)).toEqual([]); // 8 (> logicalMax 7)
    expect(hatEdges(view(0x09), hats, 0, state)).toEqual([]); // 9
  });

  it('only reads hats whose reportId matches the incoming report', () => {
    const state = new Map<number, HatDirection | null>();
    const idHats: HatField[] = [hat({ reportId: 2 })];

    expect(hatEdges(view(0x00), idHats, 1, state)).toEqual([]); // wrong report
    expect(hatEdges(view(0x00), idHats, 2, state)).toEqual([
      { index: 0, direction: 'up' },
    ]);
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
