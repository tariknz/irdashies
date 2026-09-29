import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionVisibilitySettings } from '@irdashies/types';
import { SessionVisibility } from './SessionVisibility';

const sessionVisibility: SessionVisibilitySettings = {
  race: true,
  loneQualify: true,
  openQualify: true,
  practice: true,
  offlineTesting: true,
};

describe('SessionVisibility', () => {
  it('shows qualifying options by default', () => {
    render(
      <SessionVisibility
        sessionVisibility={sessionVisibility}
        handleConfigChange={vi.fn()}
      />
    );

    expect(screen.getByRole('switch', { name: 'Lone Qualify' })).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Open Qualify' })).toBeVisible();
  });

  it('hides qualifying options when the session type is always suppressed', () => {
    render(
      <SessionVisibility
        sessionVisibility={sessionVisibility}
        handleConfigChange={vi.fn()}
        showQualifyingSessions={false}
      />
    );

    expect(
      screen.queryByRole('switch', { name: 'Lone Qualify' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Open Qualify' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Race' })).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Practice' })).toBeVisible();
  });
});
