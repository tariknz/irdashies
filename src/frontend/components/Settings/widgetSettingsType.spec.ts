import { describe, expect, it } from 'vitest';
import { widgetSettingsType } from './widgetSettingsType';

describe('widgetSettingsType', () => {
  it("gives a layout copy its original's type", () => {
    expect(
      widgetSettingsType(
        [{ id: 'standings-g1', type: 'standings' }],
        'standings-g1'
      )
    ).toBe('standings');
  });

  it('takes any other id as a type, an empty type falling back to the id', () => {
    expect(widgetSettingsType([{ id: 'relative' }], 'relative')).toBe(
      'relative'
    );
    expect(widgetSettingsType([{ id: 'fuel', type: '' }], 'fuel')).toBe('fuel');
    expect(widgetSettingsType([], 'weather')).toBe('weather');
    expect(widgetSettingsType(undefined, 'weather')).toBe('weather');
  });
});
