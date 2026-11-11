import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RadarArcStyle } from '@irdashies/types';
import { ArcEventCard } from './ArcControls';

afterEach(() => vi.restoreAllMocks());
describe('arc style keyboard selection', () => {
  it('uses one tab stop and wraps arrow selection with focus', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    function Picker() {
      const [style, setStyle] = useState<RadarArcStyle>('arc');
      return (
        <ArcEventCard
          title="Overlap"
          description="Overlap cue"
          enabled
          onToggle={vi.fn()}
          style={style}
          onStyle={setStyle}
          moduleOff={false}
          moduleName="Overlap"
          color="#fff"
          bearing={0}
          thickness={1}
        />
      );
    }
    render(<Picker />);
    const arc = screen.getByRole('radio', { name: 'Arc' });
    arc.focus();
    await userEvent.keyboard('{ArrowLeft}');
    const sector = screen.getByRole('radio', { name: 'Sector' });
    expect(sector).toHaveFocus();
    expect(sector).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)
    ).toEqual([sector]);
    await userEvent.keyboard('{Home}');
    expect(arc).toHaveFocus();
    expect(arc).toHaveAttribute('aria-checked', 'true');
  });
});
