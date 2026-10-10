import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { ConfigJson } from './RadarDevTools';

const applyPasted = (text: string) => {
  const onApply = vi.fn();
  render(
    <ConfigJson config={getWidgetDefaultConfig('radar')} onApply={onApply} />
  );
  fireEvent.change(screen.getByLabelText('Radar settings as JSON'), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Pasted' }));
  return onApply;
};

describe('ConfigJson', () => {
  it('applies pasted settings of the right type', () => {
    const onApply = applyPasted('{"range": 40, "rivalCustomColor": 16711680}');
    expect(onApply).toHaveBeenCalledWith({
      range: 40,
      rivalCustomColor: 16711680,
    });
  });

  it('applies an oval profile and class sizes that make sense', () => {
    const settings = {
      ovalProfile: { range: 50 },
      classSizes: { GT3: { length: 4.7, width: 2 } },
    };
    const onApply = applyPasted(JSON.stringify(settings));
    expect(onApply).toHaveBeenCalledWith(settings);
  });

  it.each([
    ['null', 'Expected a JSON object'],
    ['[1]', 'Expected a JSON object'],
    ['{"range": "x"}', 'Wrong type: range (expected number)'],
    ['{"tuning": null}', 'Wrong type: tuning (expected object)'],
    [
      '{"sessionVisibility": {"race": "false"}}',
      'Wrong type: sessionVisibility.race (expected boolean)',
    ],
    [
      '{"rivalCustomColor": "#fff"}',
      'rivalCustomColor (expected number or null)',
    ],
    [
      '{"ovalProfile": {"rivalCustomColor": "red"}}',
      'ovalProfile.rivalCustomColor (expected number or null)',
    ],
    [
      '{"warningArcStyle": "zigzag"}',
      'warningArcStyle (expected one of arc, segments, glow, sector)',
    ],
    [
      '{"ovalProfile": {"rivalColorMode": "rainbow"}}',
      'ovalProfile.rivalColorMode (expected one of safety, class, custom)',
    ],
    ['{"ovalProfile": 42}', 'ovalProfile (expected object or null)'],
    ['{"ovalProfile": {"range": "x"}}', 'ovalProfile.range (expected number)'],
    ['{"ovalProfile": {"nope": 1}}', 'ovalProfile.nope (not an oval setting)'],
    ['{"classSizes": {"GT3": null}}', 'classSizes.GT3 (expected a length'],
    [
      '{"classSizes": {"GT3": {"length": "4"}}}',
      'classSizes.GT3 (expected a length',
    ],
    ['{"nope": 1}', 'Unknown settings: nope'],
  ])('rejects %s', (text, message) => {
    const onApply = applyPasted(text);
    expect(onApply).not.toHaveBeenCalled();
    expect(
      screen.getByText((content) => content.includes(message))
    ).toBeTruthy();
  });
});
