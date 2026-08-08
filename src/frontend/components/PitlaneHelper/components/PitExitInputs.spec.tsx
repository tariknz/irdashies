import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as context from '@irdashies/context';
import { PitExitInputs } from './PitExitInputs';

vi.mock('@irdashies/context', () => ({
  useDriverControlsSnapshot: vi.fn(),
}));

const controls = (throttle?: number, clutch?: number) => {
  vi.mocked(context.useDriverControlsSnapshot).mockReturnValue({
    throttle,
    clutch,
  } as never);
};

describe('PitExitInputs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    controls(0, 1);
  });

  it('renders nothing when both inputs are disabled', () => {
    const { container } = render(
      <PitExitInputs showThrottle={false} showClutch={false} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('reads the typed driver-controls snapshot', () => {
    controls(0.65, 0.8);
    render(<PitExitInputs showThrottle={true} showClutch={true} />);

    expect(context.useDriverControlsSnapshot).toHaveBeenCalledOnce();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders only the enabled input', () => {
    controls(0.5, 0.2);
    const { rerender } = render(
      <PitExitInputs showThrottle={true} showClutch={false} />
    );

    expect(screen.getByText('thr')).toBeInTheDocument();
    expect(screen.queryByText('clt')).not.toBeInTheDocument();

    rerender(<PitExitInputs showThrottle={false} showClutch={true} />);
    expect(screen.getByText('clt')).toBeInTheDocument();
    expect(screen.queryByText('thr')).not.toBeInTheDocument();
  });

  it('uses safe defaults for an unavailable snapshot', () => {
    vi.mocked(context.useDriverControlsSnapshot).mockReturnValue(undefined);
    render(<PitExitInputs showThrottle={true} showClutch={true} />);

    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('has a display name for debugging', () => {
    expect(PitExitInputs.displayName).toBe('PitExitInputs');
  });
});
