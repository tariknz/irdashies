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
import { DEMO_LABELS, demoRadarFrame } from './radarDemo';
import type { RadarStyle } from './radarDraw';

const EMPTY_SNAPSHOT: RadarSnapshot = {
  focusCarIdx: null,
  playerPct: 0,
  playerSpeed: 0,
  trackLength: 0,
  focusOnPitRoad: false,
  isOnTrack: false,
  formation: null,
  follow: null,
  cars: [],
  version: 0,
};

const selectSnapshot = (snapshot: RadarSnapshot) => snapshot;
const sameVersion = (a: RadarSnapshot, b: RadarSnapshot) =>
  a.version === b.version;

/** Black or white, whichever reads better on `hex`. */
const textColorFor = (hex: string): string => {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#0f172a' : '#ffffff';
};

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

const useDemoFrame = (enabled: boolean): RadarFrame | null => {
  const [frame, setFrame] = useState<RadarFrame | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const started = performance.now();
    const timer = setInterval(
      () => setFrame(demoRadarFrame((performance.now() - started) / 1000)),
      40
    );
    return () => {
      clearInterval(timer);
      setFrame(null);
    };
  }, [enabled]);
  return enabled ? (frame ?? demoRadarFrame(0)) : null;
};

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
  const demoFrame = useDemoFrame(isDemoMode);

  const geometry = useMemo(() => {
    const path = getTrackPathData(trackId);
    return path && trackLength > 0
      ? buildTrackGeometry(path, trackLength)
      : null;
  }, [trackId, trackLength]);

  const rivalFill = colorNumToHex(settings.rivalColor) ?? '#f59e0b';
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
      for (const [carIdx, label] of Object.entries(DEMO_LABELS)) {
        map.set(
          Number(carIdx),
          appearanceFor(rivalFill, label, sizeOptions.fallback)
        );
      }
      return map;
    }
    for (const driver of drivers ?? []) {
      const fill =
        settings.rivalColorMode === 'class'
          ? (colorNumToHex(driver.CarClassColor) ?? rivalFill)
          : rivalFill;
      const size = resolveCarSize(
        driver.CarClassShortName,
        driver.CarScreenName,
        sizeOptions
      );
      map.set(driver.CarIdx, appearanceFor(fill, driver.CarNumber ?? '', size));
    }
    return map;
  }, [drivers, isDemoMode, rivalFill, settings.rivalColorMode, sizeOptions]);

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
    () => ({
      range: settings.range,
      carLength: focusSize.length,
      carWidth: focusSize.width,
      showWarnings: settings.showWarnings,
      cautionDistance: settings.cautionDistance,
      showCarNumbers: settings.showCarNumbers,
      showTrackMap: settings.showTrackMap,
      trackWidth: settings.trackWidth,
      mapOpacity: settings.mapOpacity,
      showRings: settings.showRings,
      ringSpacing: settings.ringSpacing,
      playerColor: colorNumToHex(settings.playerColor) ?? '#ffffff',
      backgroundOpacity: settings.background.opacity,
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
  const visible =
    isDemoMode ||
    (sessionVisible && onTrackOk && (!settings.autoHide || autoVisible));

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
        />
      )}
    </div>
  );
};
