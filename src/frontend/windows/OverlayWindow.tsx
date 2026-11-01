import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import { ThemeManager } from '../components/ThemeManager/ThemeManager';
import { HideUIWrapper } from '../components/HideUIWrapper/HideUIWrapper';
import { LapTraceUpdater } from '../components/OverlayContainer/LapTraceUpdater';
import { ProfileSwitchOverlay } from '../components/ProfileSwitchOverlay/ProfileSwitchOverlay';
import { OverlayContainer } from '../components/OverlayContainer';
import { RendererDataProviders } from '../components/RendererDataProviders/RendererDataProviders';

/** Shared display windows, including the existing layout editor. */
export default function OverlayWindow() {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <RendererDataProviders />
        <LapTraceUpdater />
        <HideUIWrapper>
          <ProfileSwitchOverlay>
            <ThemeManager>
              <OverlayContainer />
            </ThemeManager>
          </ProfileSwitchOverlay>
        </HideUIWrapper>
      </RunningStateProvider>
    </DashboardProvider>
  );
}
