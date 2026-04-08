import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  // Mock WAAPI animate() — JSDOM doesn't implement it
  let mockAnimations: {
    currentTime: CSSNumberish | null;
    cancel: ReturnType<typeof vi.fn>;
  }[];
  let perfNowValue = 0;

  beforeEach(() => {
    mockAnimations = [];
    // Advance performance.now() to bust syncedNow() frame cache between tests
    perfNowValue += 1000;
    vi.spyOn(performance, 'now').mockReturnValue(perfNowValue);
    HTMLElement.prototype.animate = vi.fn(() => {
      const anim = {
        currentTime: 0 as CSSNumberish | null,
        cancel: vi.fn(),
      };
      mockAnimations.push(anim);
      return anim as unknown as Animation;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (HTMLElement.prototype as any).animate;
  });
  it('renders the driver name when not hidden', () => {
    const { container } = renderInTable(<DriverNameCell name="Driver A" />);

    expect(container.textContent).toContain('Driver A');
  });

  it('creates WAAPI animations when shouldAnimate is true', () => {
    renderInTable(
      <DriverNameCell
        name="Driver A"
        label="Tag Label"
        nameDisplay="both"
        animationCycleTime={5}
      />
    );

    // Two animations: primary + secondary
    expect(HTMLElement.prototype.animate).toHaveBeenCalledTimes(2);

    // Verify keyframe structure
    const calls = vi.mocked(HTMLElement.prototype.animate).mock.calls;
    expect(calls[0][1]).toEqual({ duration: 10000, iterations: Infinity });
    expect(calls[1][1]).toEqual({ duration: 10000, iterations: Infinity });
  });

  it('seeks animations to Date.now() phase on mount', () => {
    // 2500ms % 10000ms = 2500ms
    vi.spyOn(Date, 'now').mockReturnValue(2500);

    renderInTable(
      <DriverNameCell
        name="Driver A"
        label="Tag Label"
        nameDisplay="both"
        animationCycleTime={5}
      />
    );

    expect(mockAnimations).toHaveLength(2);
    expect(mockAnimations[0].currentTime).toBe(2500);
    expect(mockAnimations[1].currentTime).toBe(2500);
  });

  it('re-creates animations when animationCycleTime changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1500);

    const { rerender } = renderInTable(
      <DriverNameCell
        name="Driver A"
        label="Tag Label"
        nameDisplay="both"
        animationCycleTime={5}
      />
    );

    expect(mockAnimations).toHaveLength(2);
    const oldAnims = [...mockAnimations];

    // Change freq: 3500ms % 20000ms = 3500ms (10s * 2)
    // Advance performance.now() to bust the syncedNow() frame cache
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    vi.spyOn(Date, 'now').mockReturnValue(3500);

    rerender(
      <table>
        <tbody>
          <tr>
            <DriverNameCell
              name="Driver A"
              label="Tag Label"
              nameDisplay="both"
              animationCycleTime={10}
            />
          </tr>
        </tbody>
      </table>
    );

    // Old animations cancelled
    expect(oldAnims[0].cancel).toHaveBeenCalled();
    expect(oldAnims[1].cancel).toHaveBeenCalled();

    // New animations created (4 total: 2 old + 2 new)
    expect(mockAnimations).toHaveLength(4);
    expect(mockAnimations[2].currentTime).toBe(3500);
    expect(mockAnimations[3].currentTime).toBe(3500);
  });

  it('does not create animations when shouldAnimate is false', () => {
    renderInTable(<DriverNameCell name="Driver A" nameDisplay="name" />);

    expect(HTMLElement.prototype.animate).not.toHaveBeenCalled();
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
