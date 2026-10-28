import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SessionBarSnapshot } from '@irdashies/types';
import { WindItem } from './WindItem';

const mocks = vi.hoisted(() => ({
  snapshot: undefined as Partial<SessionBarSnapshot> | undefined,
}));

vi.mock('@irdashies/context', () => ({
  useSessionBarSnapshot: () => mocks.snapshot,
}));

describe('WindItem', () => {
  beforeEach(() => {
    mocks.snapshot = undefined;
  });

  it('shows the speed and an arrow when the sim reports wind', () => {
    mocks.snapshot = {
      displayUnits: 1,
      windVelocity: 5,
      windDirection: 1,
      windYaw: 0,
    };
    const { container } = render(
      <WindItem settings={undefined} standalone={false} />
    );
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows no reading and no arrow when the sim reports no wind', () => {
    // LMU: no WindVel or WindDir at all.
    mocks.snapshot = { displayUnits: 1 };
    const { container } = render(
      <WindItem settings={undefined} standalone={false} />
    );
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
