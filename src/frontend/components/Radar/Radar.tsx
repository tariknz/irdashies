import { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard, useSessionVisibility } from '@irdashies/context';
import { RadarDisplay } from './components/RadarDisplay';
import { useRadar } from './hooks/useRadar';
import { useRadarFade } from './hooks/useRadarFade';
import { useRadarSettings } from './hooks/useRadarSettings';
import { RADAR_SHOW_RANGE_MARGIN_M } from './radarFade';
import type { RadarBlip } from './radarBlips';

const DEMO_BLIPS: RadarBlip[] = [
  {
    carIdx: 1,
    alongM: 12,
    lateralM: 0.3,
    relYaw: 0,
    gapM: 12,
    side: null,
    rimSignal: null,
    carNumber: '24',
    isPaceCar: false,
  },
  {
    carIdx: 2,
    alongM: -3.2,
    lateralM: -1.9,
    relYaw: 0.05,
    gapM: 3.2,
    side: null,
    rimSignal: 'left',
    carNumber: '7',
    isPaceCar: false,
  },
  {
    carIdx: 3,
    alongM: -0.8,
    lateralM: -2.1,
    relYaw: 0,
    gapM: 0.8,
    side: -1,
    rimSignal: 'left',
    carNumber: '51',
    isPaceCar: false,
  },
  {
    carIdx: 5,
    alongM: 0.4,
    lateralM: 0,
    relYaw: 0,
    gapM: 0.4,
    side: null,
    rimSignal: 'both',
    carNumber: '31',
    isPaceCar: false,
  },
];
const DEMO_TRACK_LENGTH_M = 5800;
const DEMO_CLASS_COLORS = ['#ffda59', '#33ceff', '#ef4444', '#06b6d4'];
const DEMO_BADGE_COLORS = ['#b91c1c', '#15803d', '#1d4ed8', '#a16207'];

const useDemoBlips = (
  mode: 'class' | 'badge' | 'custom',
  enabled: boolean
): RadarBlip[] => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(
      () => setPhase((current) => (current + 0.04) % (Math.PI * 2)),
      50
    );
    return () => window.clearInterval(timer);
  }, [enabled]);

  return useMemo(
    () =>
      DEMO_BLIPS.map((blip, index) => {
        const alongM = blip.alongM + Math.sin(phase + index * 1.7) * 1.2;
        return {
          ...blip,
          alongM,
          gapM: Math.abs(alongM),
          color:
            mode === 'class'
              ? DEMO_CLASS_COLORS[index % DEMO_CLASS_COLORS.length]
              : mode === 'badge'
                ? DEMO_BADGE_COLORS[index % DEMO_BADGE_COLORS.length]
                : null,
        };
      }),
    [mode, phase]
  );
};

export const Radar = () => {
  const settings = useRadarSettings();
  const state = useRadar({
    radarRange: settings.radarRange,
    hideInPit: settings.hideInPit,
    vehicleWidth: settings.vehicleWidth,
    vehicleLength: settings.vehicleLength,
    rivalColorMode: settings.rivalColorMode,
    colorRival: settings.colorRival,
  });
  const { isDemoMode } = useDashboard();
  const demoBlips = useDemoBlips(settings.rivalColorMode, isDemoMode);
  const sessionVisible = useSessionVisibility(settings.sessionVisibility);

  // Equality with the radar range is useless here: the car at the clipping
  // boundary cannot bring on a panel that only appears once it is visible.
  const showRange = Math.min(
    settings.showRange,
    settings.radarRange - RADAR_SHOW_RANGE_MARGIN_M
  );

  // The gate is hysteretic: `nearestGapM` jitters by fractions of a metre
  // around whatever boundary it sits on, so a plain `<= showRange` test would
  // flip the panel on and off every few frames. A car brings the panel on
  // screen inside the range and only loses it once it is past the range plus a
  // margin, so the boundary itself has a dead band no jitter can span.
  // The hold lives in a ref rather than the memoised state: it is a latch on
  // an observed gap, not a value the render derives.
  const gateShownRef = useRef(false);
  // The gate only applies while everything else already wants the panel; when
  // it does not, the latch resets so a later session starts clean.
  const gateApplies =
    !isDemoMode &&
    sessionVisible &&
    state.hasGeometry &&
    (!settings.showOnlyWhenOnTrack || state.isOnTrack) &&
    settings.showWhenNearby;
  if (gateApplies) {
    const gap = state.nearestGapM;
    if (gateShownRef.current) {
      if (gap === null || gap > showRange + Math.max(1, showRange * 0.1)) {
        gateShownRef.current = false;
      }
    } else if (gap !== null && gap <= showRange) {
      gateShownRef.current = true;
    }
  } else {
    gateShownRef.current = false;
  }

  const wanted =
    sessionVisible &&
    (!settings.showOnlyWhenOnTrack || state.isOnTrack) &&
    state.hasGeometry &&
    (!settings.showWhenNearby || gateShownRef.current);
  // Demo mode ignores visibility rules so the widget can be seen while editing.
  const fade = useRadarFade(isDemoMode || wanted, settings.fadeSeconds);

  if (fade <= 0) return <></>;

  return (
    <div className="h-full w-full" style={{ opacity: fade }}>
      <RadarDisplay
        blips={isDemoMode ? demoBlips : state.blips}
        radarRange={settings.radarRange}
        vehicleWidth={settings.vehicleWidth}
        vehicleLength={settings.vehicleLength}
        showCarNumbers={settings.showCarNumbers}
        colorRival={settings.colorRival}
        colorPlayer={settings.colorPlayer}
        viewMode={settings.viewMode}
        rearCameraTilt={settings.rearCameraTilt}
        bgOpacity={settings.background.opacity}
        sideIndicatorStyle={settings.sideIndicatorStyle}
        sideIndicatorColor={settings.sideIndicatorColor}
        sideIndicatorOpacity={settings.sideIndicatorOpacity}
        sideIndicatorEnabled={settings.sideIndicatorEnabled}
        trackLengthM={isDemoMode ? DEMO_TRACK_LENGTH_M : state.trackLengthM}
        showFollowingMap={settings.showTrackMap}
        followingMapPath={state.followingMapPath}
        followingMapPointCount={state.followingMapPointCount}
        followingMapWindowM={state.followingMapWindowM}
        followingMapBorderColor={settings.mapBorderColor}
        followingMapBorderOpacity={settings.mapBorderOpacity}
        followingMapFillColor={settings.mapFillColor}
        followingMapFillOpacity={settings.mapFillOpacity}
        followingMapSvgPath={state.followingMapSvgPath}
        followingMapCameraPlayerX={state.followingMapCameraPlayerX}
        followingMapCameraPlayerY={state.followingMapCameraPlayerY}
        followingMapCameraForwardX={state.followingMapCameraForwardX}
        followingMapCameraForwardY={state.followingMapCameraForwardY}
        followingMapCameraRightX={state.followingMapCameraRightX}
        followingMapCameraRightY={state.followingMapCameraRightY}
        followingMapUnitsPerMetre={state.followingMapUnitsPerMetre}
      />
    </div>
  );
};
