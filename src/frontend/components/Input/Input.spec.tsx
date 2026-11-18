import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { Input } from './Input';

const state = vi.hoisted(() => ({
  driving: false,
  sessionVisible: true,
  mounts: 0,
  unmounts: 0,
}));
vi.mock('@irdashies/context', async (original) => ({
  ...(await original<typeof import('@irdashies/context')>()),
  useDrivingState: () => ({ isDriving: state.driving }),
  useSessionVisibility: () => state.sessionVisible,
}));
vi.mock('./hooks/useInputSettings', async (original) => ({
  ...(await original<typeof import('./hooks/useInputSettings')>()),
  useInputSettings: () => undefined,
}));
vi.mock('./hooks/useInputs', async () => {
  const { useEffect } = await import('react');
  return {
    useInputs: () => {
      useEffect(() => {
        state.mounts++;
        return () => {
          state.unmounts++;
        };
      }, []);
      return {};
    },
  };
});
vi.mock('@irdashies/domain/shiftLight', () => ({
  useBlink: () => false,
  useShiftFlashActive: () => false,
}));
vi.mock('./InputContainer/InputContainer', () => ({
  InputContainer: () => <div>Inputs</div>,
}));

afterEach(() => {
  cleanup();
  state.driving = false;
  state.sessionVisible = true;
  state.mounts = 0;
  state.unmounts = 0;
});

describe('Input high-frequency consumers', () => {
  it('mounts only when visible and releases subscriptions on hide', () => {
    const config = getWidgetDefaultConfig('input');
    const view = render(<Input {...config} />);
    expect(state.mounts).toBe(0);
    state.driving = true;
    view.rerender(<Input {...config} />);
    expect(state.mounts).toBe(1);
    state.driving = false;
    view.rerender(<Input {...config} />);
    expect(state.unmounts).toBe(1);
    state.driving = true;
    view.rerender(<Input {...config} />);
    expect(state.mounts).toBe(2);
    state.sessionVisible = false;
    view.rerender(<Input {...config} />);
    expect(state.unmounts).toBe(2);
  });

  it('can remain active off-track when the configuration requests it', () => {
    render(
      <Input {...getWidgetDefaultConfig('input')} showOnlyWhenOnTrack={false} />
    );
    expect(state.mounts).toBe(1);
  });
});
