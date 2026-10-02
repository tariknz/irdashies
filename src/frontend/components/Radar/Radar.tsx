import { useEffect, useMemo, useState } from 'react';
import {
  useDashboard,
  useRadarSelector,
  useSessionDrivers,
  useSessionStore,
  useSessionVisibility,
  useTrackLength,
} from '@irdashies/context';
import { buildTrackGeometry, getTrackPathData } from '@irdashies/domain/track';
import type { RadarSnapshot } from '@irdashies/types';
import { colorNumToHex } from '@irdashies/utils/colors';
import {
  RadarDisplay,
  type RadarCarAppearance,
  type RadarFrame,
} from './components/RadarDisplay';
import { useRadarSettings } from './hooks/useRadarSettings';
import { resolveCarSize, type CarSize } from '@irdashies/domain/radar/carSizes';
import {
  nearestDistance,
  nextAutoHideVisible,
  selectRadarCars,
} from './radarModel';
import { demoAppearance } from './radarDemo';
import { useDemoRadarFrame } from './hooks/useDemoRadarFrame';
import { paler, rivalFill, textColorFor } from './radarColors';
import type { RadarStyle } from './radarDraw';
import { radarStyleFrom } from './radarStyle';

const EMPTY_SNAPSHOT: RadarSnapshot = {
  focusCarIdx: null,
  playerPct: 0,
  playerSpeed: 0,
  trackLength: 0,
  focusOnPitRoad: false,
  focusInPitBox: false,
  isOnTrack: false,
  formation: null,
  follow: null,
  cars: [],
  version: 0,
};

const selectSnapshot = (snapshot: RadarSnapshot) => snapshot;
const sameVersion = (a: RadarSnapshot, b: RadarSnapshot) =>
  a.version === b.version;

const appearanceFor = (
  fill: string,
  label: string,
  size: CarSize
): RadarCarAppearance => ({
  fill,
  textColor: textColorFor(fill),
  label,
  length: size.length,
  width: size.width,
});

export const Radar = () => {
  const settings = useRadarSettings();
  const { isDemoMode } = useDashboard();
  const sessionVisible = useSessionVisibility(settings.sessionVisibility);
  const snapshot =
    useRadarSelector(selectSnapshot, { equality: sameVersion }) ??
    EMPTY_SNAPSHOT;
  const drivers = useSessionDrivers();
  const trackId = useSessionStore(
    (state) => state.session?.WeekendInfo?.TrackID
  );
  const trackLength = useTrackLength();
  const demoFrame = useDemoRadarFrame(isDemoMode);

  const geometry = useMemo(() => {
    const path = getTrackPathData(trackId);
    return path && trackLength > 0
      ? buildTrackGeometry(path, trackLength)
      : null;
  }, [trackId, trackLength]);

  const playerFill = colorNumToHex(settings.playerColor) ?? '#ffffff';
  const customFill =
    colorNumToHex(settings.rivalCustomColor ?? undefined) ?? paler(playerFill);
  const colorMode = settings.rivalColorMode;
  const sizeOptions = useMemo(
    () => ({
      sizeByClass: settings.sizeByClass,
      classSizes: settings.classSizes,
      fallback: { length: settings.carLength, width: settings.carWidth },
    }),
    [
      settings.sizeByClass,
      settings.classSizes,
      settings.carLength,
      settings.carWidth,
    ]
  );
  const appearance = useMemo(() => {
    const map = new Map<number, RadarCarAppearance>();
    if (isDemoMode) {
      return demoAppearance(colorMode, customFill, sizeOptions.fallback);
    }
    for (const driver of drivers ?? []) {
      const fill = rivalFill(colorMode, customFill, {
        license: driver.LicString,
        rating: driver.IRating,
        classColor: colorNumToHex(driver.CarClassColor),
      });
      const size = resolveCarSize(
        driver.CarClassShortName,
        driver.CarScreenName,
        sizeOptions
      );
      map.set(driver.CarIdx, appearanceFor(fill, driver.CarNumber ?? '', size));
    }
    return map;
  }, [drivers, isDemoMode, customFill, colorMode, sizeOptions]);

  // Our own size: the focus car's class, so overlap is judged on both cars.
  const focusSize =
    (snapshot.focusCarIdx !== null && !isDemoMode
      ? appearance.get(snapshot.focusCarIdx)
      : undefined) ?? sizeOptions.fallback;

  const cars = useMemo(
    () =>
      selectRadarCars(snapshot, {
        range: settings.range,
        carLength: settings.carLength,
        hideInPit: settings.hideInPit,
      }),
    [snapshot, settings.range, settings.carLength, settings.hideInPit]
  );

  const frame: RadarFrame = useMemo(
    () =>
      demoFrame ?? {
        playerPct: snapshot.playerPct,
        playerSpeed: snapshot.playerSpeed,
        trackLength: snapshot.trackLength,
        cars,
        follow: snapshot.follow,
      },
    [demoFrame, snapshot, cars]
  );

  const style: RadarStyle = useMemo(
    () =>
      radarStyleFrom(settings, {
        length: focusSize.length,
        width: focusSize.width,
      }),
    [settings, focusSize.length, focusSize.width]
  );

  const nearest = nearestDistance(frame.cars);
  const [autoVisible, setAutoVisible] = useState(false);
  useEffect(() => {
    setAutoVisible((wasVisible) =>
      nextAutoHideVisible(wasVisible, nearest, {
        showDistance: settings.showDistance,
        hideDistance: settings.hideDistance,
      })
    );
  }, [nearest, settings.showDistance, settings.hideDistance]);

  const onTrackOk = !settings.showOnlyWhenOnTrack || snapshot.isOnTrack;
  const inPitBox = settings.hideInPitBox && snapshot.focusInPitBox;
  const visible =
    isDemoMode ||
    (sessionVisible &&
      onTrackOk &&
      !inPitBox &&
      (!settings.autoHide || autoVisible));

  // Keep painting through the fade-out, then stop.
  const fadeMs = Math.max(0, settings.fadeSeconds * 1000);
  const [painting, setPainting] = useState(visible);
  useEffect(() => {
    if (visible) {
      setPainting(true);
      return;
    }
    const timer = setTimeout(() => setPainting(false), fadeMs);
    return () => clearTimeout(timer);
  }, [visible, fadeMs]);

  if (!isDemoMode && !sessionVisible) return null;

  return (
    <div
      className="w-full h-full"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${fadeMs}ms ease-out`,
      }}
    >
      {(visible || painting) && (
        <RadarDisplay
          frame={frame}
          appearance={appearance}
          geometry={isDemoMode ? null : geometry}
          style={style}
          active={visible || painting}
          extrapolationS={settings.tuning.extrapolationS}
          laneGapM={settings.tuning.laneGapM}
        />
      )}
    </div>
  );
};
