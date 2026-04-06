import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WidgetVisibilityContainer } from './WidgetVisibilityContainer';

vi.mock('./useSessionVisibility', () => ({
  useSessionVisibility: vi.fn(),
}));

vi.mock('@irdashies/context', () => ({
  useDrivingState: vi.fn(),
}));

import { useSessionVisibility } from './useSessionVisibility';
import { useDrivingState } from '@irdashies/context';
import {
  OnTrackVisibilityConfig,
  SessionVisibilityConfig,
} from '@irdashies/types';

// Test config. Values in sessionVisibility doesn't matter, as it just gets passed to useSessionVisibility,
// and we are mocking the return value of that function
const baseConfig: SessionVisibilityConfig & OnTrackVisibilityConfig = {
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
  showOnlyWhenOnTrack: true,
};

const testConfig = baseConfig as unknown as Record<string, unknown>;

describe('WidgetVisibilityContainer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should render when all conditions met', () => {
    vi.mocked(useDrivingState).mockReturnValue({ isDriving: true });
    vi.mocked(useSessionVisibility).mockReturnValue(true);

    const { container } = render(
      <WidgetVisibilityContainer visibilityConfig={testConfig}>
        <div id={'widget'}></div>
      </WidgetVisibilityContainer>
    );

    expect(container.querySelector('#widget')).toBeInTheDocument();
  });

  it('should hide when showOnlyWhenOnTrack and isDriving is false', () => {
    vi.mocked(useDrivingState).mockReturnValue({ isDriving: false });
    vi.mocked(useSessionVisibility).mockReturnValue(true);

    const { container } = render(
      <WidgetVisibilityContainer visibilityConfig={testConfig}>
        <div id={'widget'}>Widget</div>
      </WidgetVisibilityContainer>
    );

    expect(container.querySelector('#widget')).not.toBeInTheDocument();
  });

  it('should hide when sessionVisibility is false', () => {
    vi.mocked(useDrivingState).mockReturnValue({ isDriving: true });
    vi.mocked(useSessionVisibility).mockReturnValue(false);

    const { container } = render(
      <WidgetVisibilityContainer visibilityConfig={testConfig}>
        <div id={'widget'}>Widget</div>
      </WidgetVisibilityContainer>
    );

    expect(container.querySelector('#widget')).not.toBeInTheDocument();
  });
});
