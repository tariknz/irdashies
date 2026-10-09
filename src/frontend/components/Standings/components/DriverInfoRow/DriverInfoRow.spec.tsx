import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { deepMergeConfig, getWidgetDefaultConfig } from '@irdashies/types';
import { DriverInfoRow } from './DriverInfoRow';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: undefined }),
}));

describe('DriverInfoRow', () => {
  it.each(['driverName', 'teamName'])(
    'renders when persisted %s settings are null',
    (key) => {
      const defaults = getWidgetDefaultConfig('standings');
      const config = deepMergeConfig(
        { ...defaults },
        {
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
