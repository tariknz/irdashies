import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CountryFlag } from './CountryFlag';

const flag = (props: Parameters<typeof CountryFlag>[0]) =>
  render(<CountryFlag {...props} />).container;

describe('CountryFlag', () => {
  it('draws an iRacing flair id as its flag-icons flag', () => {
    // 223 is the United States.
    expect(flag({ flairId: 223 }).querySelector('.fi.fi-us')).not.toBeNull();
  });

  it('prefers a country code, which is how LMU reports it', () => {
    const container = flag({ flairId: 223, countryCode: 'FR' });
    expect(container.querySelector('.fi.fi-fr')).not.toBeNull();
    expect(container.querySelector('.fi-us')).toBeNull();
  });

  it('draws a GB subdivision code', () => {
    expect(
      flag({ flairId: 0, countryCode: 'GB-SCT' }).querySelector('.fi-gb-sct')
    ).not.toBeNull();
  });

  it('keeps the iRacing logo for a flair id the table does not know', () => {
    const container = flag({ flairId: 99999 });
    expect(container.querySelector('.fi')).toBeNull();
    expect(container.firstChild).not.toBeNull();
  });

  it('draws nothing for a driver with no country at all', () => {
    // An LMU AI: no nationality, and no flair id either.
    const container = flag({ flairId: 0 });
    expect(container.firstChild).toBeNull();
    expect(container.textContent).toBe('');
  });
});
