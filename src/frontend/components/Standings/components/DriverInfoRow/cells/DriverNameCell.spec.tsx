import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { DriverNameCell } from './DriverNameCell';

const renderInTable = (component: ReactElement) => {
  return render(
    <table>
      <tbody>
        <tr>{component}</tr>
      </tbody>
    </table>
  );
};

describe('DriverNameCell', () => {
  it('renders the driver name when not hidden', () => {
    const { container } = renderInTable(<DriverNameCell name="Driver A" />);

    expect(container.textContent).toContain('Driver A');
  });

  it('sets animationDelay on both spans when shouldAnimate is true', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    const { container } = renderInTable(
      <DriverNameCell
        name="Driver A"
        label="Tag Label"
        nameDisplay="both"
        alternateFrequency={5}
      />
    );

    const spans = container.querySelectorAll(
      'span[class*="animate-name-slide"]'
    );
    expect(spans).toHaveLength(2);
    spans.forEach((span) => {
      expect((span as HTMLElement).style.animationDelay).toBe('-1.000s');
    });

    vi.restoreAllMocks();
  });

  it('re-syncs animationDelay when alternateFrequency changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    const { container, rerender } = renderInTable(
      <DriverNameCell
        name="Driver A"
        label="Tag Label"
        nameDisplay="both"
        alternateFrequency={5}
      />
    );

    const spans = container.querySelectorAll(
      'span[class*="animate-name-slide"]'
    );
    spans.forEach((span) => {
      expect((span as HTMLElement).style.animationDelay).toBe('-1.000s');
    });

    vi.spyOn(Date, 'now').mockReturnValue(3000);

    rerender(
      <table>
        <tbody>
          <tr>
            <DriverNameCell
              name="Driver A"
              label="Tag Label"
              nameDisplay="both"
              alternateFrequency={10}
            />
          </tr>
        </tbody>
      </table>
    );

    // (3000/1000) % 10 = 3 → -3.000s
    spans.forEach((span) => {
      expect((span as HTMLElement).style.animationDelay).toBe('-3.000s');
    });

    vi.restoreAllMocks();
  });

  it('toggles radio icon visibility based on radioActive', () => {
    const { container, rerender } = renderInTable(
      <DriverNameCell name="Driver A" radioActive />
    );
    const icon = container.querySelector('span svg');
    expect(icon).toBeTruthy();
    expect(icon?.parentElement?.className).toContain('w-4');

    rerender(
      <table>
        <tbody>
          <tr>
            <DriverNameCell name="Driver A" radioActive={false} />
          </tr>
        </tbody>
      </table>
    );
    const hiddenIcon = container.querySelector('span svg');
    expect(hiddenIcon).toBeTruthy();
    expect(hiddenIcon?.parentElement?.className).toContain('w-0');
  });
});
