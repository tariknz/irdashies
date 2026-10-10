import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingProp, SettingProps } from './SettingProp';

const renderWind = (config: Record<string, unknown>) => {
  const onChange = vi.fn();
  render(
    <SettingProps widget="wind" config={config} onChange={onChange}>
      <SettingProp path="background.opacity" />
      <SettingProp path="units" />
      <SettingProp path="showOnlyWhenOnTrack" />
      <SettingProp path="no.such.path" />
    </SettingProps>
  );
  return onChange;
};

describe('SettingProp', () => {
  it('picks the control and label from the manifest', () => {
    renderWind({ background: { opacity: 40 }, units: 'auto' });
    expect(screen.getByText('Background Opacity')).toBeInTheDocument();
    expect(screen.getByText('mph')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('sends the whole top-level branch with one leaf changed', () => {
    const onChange = renderWind({
      background: { opacity: 40, extra: 1 },
      units: 'auto',
    });
    fireEvent.change(screen.getByRole('slider'), { target: { value: '55' } });
    expect(onChange).toHaveBeenLastCalledWith({
      background: { opacity: 55, extra: 1 },
    });
    fireEvent.click(screen.getByText('mph'));
    expect(onChange).toHaveBeenLastCalledWith({ units: 'Imperial' });
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith({ showOnlyWhenOnTrack: true });
  });
});
