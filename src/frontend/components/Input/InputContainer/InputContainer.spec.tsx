import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { InputContainer } from './InputContainer';

const defaults = getWidgetDefaultConfig('input');

const gearOnly = {
  ...defaults,
  layoutTree: {
    id: 'root',
    type: 'box' as const,
    direction: 'col' as const,
    widgets: ['gear'],
  },
};

describe('InputContainer', () => {
  it('renders only the elements in the layout tree', () => {
    const { container, getByText } = render(
      <InputContainer gear={3} speed={20} settings={gearOnly} />
    );
    expect(getByText('3')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('keeps elements mounted across telemetry updates', () => {
    const { getByText, rerender } = render(
      <InputContainer gear={3} speed={20} settings={gearOnly} />
    );
    const before = getByText('3').closest('.font-mono');

    rerender(<InputContainer gear={4} speed={21} settings={gearOnly} />);

    expect(getByText('4').closest('.font-mono')).toBe(before);
  });

  it('uses the flash colour as the background while flashing', () => {
    const { container, rerender } = render(
      <InputContainer gear={3} settings={gearOnly} flashColor="#9333ea" />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.backgroundColor).toBe('rgb(147, 51, 234)');

    rerender(<InputContainer gear={3} settings={gearOnly} />);
    expect(root.style.backgroundColor).toBe('');
  });
});
