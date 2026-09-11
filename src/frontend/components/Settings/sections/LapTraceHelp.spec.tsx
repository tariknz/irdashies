import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { LapTraceHelp } from './LapTraceHelp';

/**
 * The help text repeats facts the importers enforce. These pin the few that
 * would send a driver looking in the wrong place if they drifted.
 */
describe('LapTraceHelp', () => {
  afterEach(cleanup);

  it('names the folder iRacing writes telemetry to', () => {
    render(<LapTraceHelp />);

    // The .ibt file picker opens here by default, so the text and the picker
    // have to agree.
    expect(
      screen.getByText(String.raw`Documents\iRacing\telemetry`)
    ).toBeTruthy();
  });

  it('shows the export menu screenshot with a described alternative', () => {
    render(<LapTraceHelp />);

    // The step it illustrates is the one nobody finds on their own, and the
    // alt text has to carry it for anyone who cannot see the picture.
    const shot = screen.getByRole('img', { name: /Export to CSV/i });
    expect(shot.getAttribute('src')).toBeTruthy();
  });

  it('lists every column the Garage 61 parser requires', () => {
    render(<LapTraceHelp />);

    for (const column of [
      'Speed',
      'LapDistPct',
      'Lat',
      'Lon',
      'Brake',
      'Throttle',
      'Gear',
      'ABSActive',
    ]) {
      expect(screen.getByText(column)).toBeTruthy();
    }
  });

  it('does not promise that an imported lap is matched to the session', () => {
    render(<LapTraceHelp />);

    // Both imports are global slots now; telling the driver otherwise would
    // have them hunting for a track match that is no longer checked.
    expect(
      screen.queryByText(/track and car the lap was driven on/i)
    ).toBeNull();
  });
});
