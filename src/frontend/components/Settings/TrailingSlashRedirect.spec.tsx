import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TrailingSlashRedirect } from './TrailingSlashRedirect';

function Location() {
  const { pathname, search } = useLocation();
  return <output>{pathname + search}</output>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TrailingSlashRedirect>
        <Location />
      </TrailingSlashRedirect>
    </MemoryRouter>
  );

describe('TrailingSlashRedirect', () => {
  it('sends a path with a trailing slash to the same path without it', () => {
    renderAt('/settings/profiles/?tab=1');
    expect(screen.getByRole('status')).toHaveTextContent(
      '/settings/profiles?tab=1'
    );
  });

  it('leaves a path without one as it is', () => {
    renderAt('/settings/profiles');
    expect(screen.getByRole('status')).toHaveTextContent('/settings/profiles');
  });
});
