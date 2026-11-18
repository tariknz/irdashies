import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BroadcastModuleDescription } from './BroadcastModuleDescription';

describe('BroadcastModuleDescription', () => {
  it('adds the OBS URL for the module under its description', () => {
    render(
      <p>
        <BroadcastModuleDescription obsUrl="http://localhost:3000/widget/broadcastticker?profile=default">
          Scrolling ticker.
        </BroadcastModuleDescription>
      </p>
    );

    expect(screen.getByText(/Scrolling ticker\./)).toBeInTheDocument();
    expect(screen.getByText(/OBS URL for this module:/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'http://localhost:3000/widget/broadcastticker?profile=default'
      )
    ).toHaveClass('select-all');
  });

  it('shows the description alone without a URL', () => {
    render(
      <p>
        <BroadcastModuleDescription>
          Scrolling ticker.
        </BroadcastModuleDescription>
      </p>
    );

    expect(screen.queryByText(/OBS URL/)).not.toBeInTheDocument();
  });
});
