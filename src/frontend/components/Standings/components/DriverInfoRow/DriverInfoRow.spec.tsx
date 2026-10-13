import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  RATING_COLUMN_IDS,
  deepMergeConfig,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { DriverInfoRow } from './DriverInfoRow';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: undefined }),
}));

const baseProps = {
  carIdx: 3,
  classColor: 0xff0000,
  name: 'A Driver',
  isPlayer: false,
  hasFastestTime: false,
  isMultiClass: false,
  license: 'A 4.99',
  rating: 4999,
  iratingChangeValue: 12,
  config: {
    badge: { enabled: true },
    iratingChange: { enabled: true },
  },
} as unknown as Parameters<typeof DriverInfoRow>[0];

const renderRow = (extra: Partial<Record<string, unknown>> = {}) =>
  render(
    <table>
      <tbody>
        <DriverInfoRow {...baseProps} {...extra} />
      </tbody>
    </table>
  );

const cellIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('td[data-column]')).map((td) =>
    td.getAttribute('data-column')
  );

describe('DriverInfoRow hiddenColumns', () => {
  it('renders the rating columns when nothing is hidden', () => {
    const { container } = renderRow();
    expect(cellIds(container)).toEqual(
      expect.arrayContaining([...RATING_COLUMN_IDS])
    );
  });

  it('drops a hidden column entirely rather than emptying its cell', () => {
    // The badge has no header label, so it is an identity column merged into
    // the class header bar. An empty <td> left behind would shift every cell
    // after it out of alignment -- the column has to go, not its contents.
    const { container } = renderRow({
      hiddenColumns: new Set<string>(RATING_COLUMN_IDS),
    });
    const ids = cellIds(container);
    for (const id of RATING_COLUMN_IDS) {
      expect(ids).not.toContain(id);
    }
  });

  it('hides a column that displayOrder names explicitly', () => {
    // The filter has to run ahead of the ordering logic, or an explicit
    // displayOrder would reinstate the column it was meant to remove.
    const { container } = renderRow({
      displayOrder: ['position', 'badge', 'driverName'],
      hiddenColumns: new Set<string>(['badge']),
    });
    expect(cellIds(container)).not.toContain('badge');
  });

  it('leaves other columns untouched', () => {
    const { container } = renderRow({
      hiddenColumns: new Set<string>(['badge']),
    });
    const ids = cellIds(container);
    expect(ids).toContain('iratingChange');
    expect(ids.length).toBeGreaterThan(1);
  });
});

describe('DriverInfoRow badge contents', () => {
  it('still shows the AI badge for a rated sim with no rating', () => {
    // Hiding is a per-sim decision; within a rating sim the existing
    // behaviour for an unrated driver is unchanged.
    renderRow({ license: '', rating: 0 });
    expect(screen.getByText('AI')).toBeTruthy();
  });
});

describe('DriverInfoRow', () => {
  it.each(['driverName', 'teamName'])(
    'renders when persisted %s settings are null',
    (key) => {
      const defaults = getWidgetDefaultConfig('standings');
      const config = deepMergeConfig(
        { ...defaults },
        {
          driverName: { subtext: 'none' },
          [key]: null,
        }
      ) as unknown as typeof defaults;
      const { container } = render(
        <table>
          <tbody>
            <DriverInfoRow
              carIdx={0}
              classColor={0}
              name="Alice Smith"
              teamName="Apex Racing"
              isPlayer={false}
              hasFastestTime={false}
              isMultiClass={false}
              dnf={false}
              repair={false}
              penalty={false}
              slowdown={false}
              displayOrder={['driverName', 'teamName']}
              config={config}
            />
          </tbody>
        </table>
      );

      expect(
        container.querySelector('[data-column="driverName"]')?.textContent
      ).toContain('Alice Smith');
      expect(container.querySelector('.text-slate-400')).toBeNull();
    }
  );
});
