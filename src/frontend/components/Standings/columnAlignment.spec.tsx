import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RATING_COLUMN_IDS } from '@irdashies/types';
import { getOrderedColumns } from './Standings';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: undefined }),
}));

/**
 * The header and the rows build their column lists independently --
 * getOrderedColumns in Standings.tsx, and the columns array in DriverInfoRow.
 * DriverClassHeader sums colSpan across the header list, so if the two
 * disagree about which columns exist the header stops lining up with the
 * cells. Every column shares one id space; this asserts the two lists agree.
 */

// Every column this comparison covers, enabled, so the lists are non-trivial.
const config = {
  badge: { enabled: true },
  iratingChange: { enabled: true },
  delta: { enabled: true },
  fastestTime: { enabled: true },
  lastTime: { enabled: true },
  lapCount: { enabled: true },
  stylingOptions: { columnHeaders: { enabled: true } },
} as unknown as Parameters<typeof getOrderedColumns>[0];

const headerIds = (hidden: ReadonlySet<string>) =>
  getOrderedColumns(config, false, false, false, true, hidden).map((c) => c.id);

const rowIds = (hidden: ReadonlySet<string>) => {
  const { container } = render(
    <table>
      <tbody>
        <DriverInfoRow
          {...({
            carIdx: 1,
            classColor: 0xff0000,
            name: 'A Driver',
            isPlayer: false,
            hasFastestTime: false,
            isMultiClass: false,
            license: 'A 4.99',
            rating: 4999,
            iratingChangeValue: 5,
            config,
            hiddenColumns: hidden,
          } as unknown as Parameters<typeof DriverInfoRow>[0])}
        />
      </tbody>
    </table>
  );
  return Array.from(container.querySelectorAll('td[data-column]')).map((td) =>
    td.getAttribute('data-column')
  );
};

describe('header and cell column lists', () => {
  it('agree on which rating columns are present', () => {
    const shown = new Set<string>();
    for (const id of RATING_COLUMN_IDS) {
      expect(headerIds(shown)).toContain(id);
      expect(rowIds(shown)).toContain(id);
    }
  });

  it('agree on which rating columns are hidden', () => {
    const hidden = new Set<string>(RATING_COLUMN_IDS);
    const headers = headerIds(hidden);
    const cells = rowIds(hidden);
    for (const id of RATING_COLUMN_IDS) {
      expect(headers).not.toContain(id);
      expect(cells).not.toContain(id);
    }
  });

  it('hides the same count from both lists', () => {
    // The real alignment invariant: whatever the rule removes, it removes
    // from both sides equally.
    const hidden = new Set<string>(RATING_COLUMN_IDS);
    const headerDelta = headerIds(new Set()).length - headerIds(hidden).length;
    const cellDelta = rowIds(new Set()).length - rowIds(hidden).length;

    expect(headerDelta).toBe(RATING_COLUMN_IDS.length);
    expect(cellDelta).toBe(headerDelta);
  });
});
