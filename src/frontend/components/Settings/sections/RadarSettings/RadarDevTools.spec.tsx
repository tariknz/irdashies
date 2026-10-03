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
    const onApply = applyPasted('{"range": 40, "rivalCustomColor": "#fff"}');
    expect(onApply).toHaveBeenCalledWith({
      range: 40,
      rivalCustomColor: '#fff',
    });
  });

  it.each([
    ['null', 'Expected a JSON object'],
    ['[1]', 'Expected a JSON object'],
    ['{"range": "x"}', 'Wrong type: range (expected number)'],
    ['{"tuning": null}', 'Wrong type: tuning (expected object)'],
    ['{"nope": 1}', 'Unknown settings: nope'],
  ])('rejects %s', (text, message) => {
    const onApply = applyPasted(text);
    expect(onApply).not.toHaveBeenCalled();
    expect(
      screen.getByText(new RegExp(message.replace(/[()]/g, '\\$&')))
    ).toBeTruthy();
  });
});
