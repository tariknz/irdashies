import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defaultDashboard } from '@irdashies/types';
import { BroadcastPreview } from './BroadcastPreview';

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ currentDashboard: defaultDashboard }),
  // Live channels are not wired up in tests; the preview's cars are made up.
  useCarIdxSpeed: () => [],
  useSessionBarSelector: () => undefined,
}));

describe('BroadcastPreview', () => {
  it.each([
    ['broadcast', 'Bourdais'],
    ['broadcastticker', 'Standings'],
    ['broadcastevents', 'Incident'],
    ['broadcastweather', 'Conditions'],
    ['broadcastpodium', 'Podium'],
  ])('draws %s on made-up cars', (module, text) => {
    render(<BroadcastPreview module={module} />);
    expect(screen.getAllByText(new RegExp(text, 'i')).length).toBeGreaterThan(
      0
    );
  });
});
