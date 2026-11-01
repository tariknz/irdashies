import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileSwitchOverlay } from './ProfileSwitchOverlay';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ containerBoundsInfo: null }),
}));

afterEach(() => {
  cleanup();
  delete window.profileSwitch;
});

describe('profile-switch presentation', () => {
  it.each([true, false])(
    'keeps transition hiding while banner rendering is %s',
    (showBanner) => {
      let transition: Parameters<
        NonNullable<Window['profileSwitch']>['onTransition']
      >[0] = () => undefined;
      const unsubscribe = vi.fn();
      window.profileSwitch = {
        onTransition: (callback) => {
          transition = callback;
          return unsubscribe;
        },
      };
      const { unmount } = render(
        <ProfileSwitchOverlay showBanner={showBanner}>
          <span>Widget content</span>
        </ProfileSwitchOverlay>
      );
      act(() => transition({ hidden: true, name: 'Race profile' }));
      expect(screen.getByText('Widget content').parentElement).toHaveClass(
        'invisible'
      );
      act(() =>
        transition({ hidden: false, name: 'Race profile', showBanner: true })
      );
      expect(screen.getByText('Widget content').parentElement).not.toHaveClass(
        'invisible'
      );
      expect(screen.queryByText('Race profile') !== null).toBe(showBanner);
      unmount();
      expect(unsubscribe).toHaveBeenCalledOnce();
    }
  );
});
