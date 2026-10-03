import { useMemo } from 'react';
import type { RadarConfig } from '@irdashies/types';
import { colorNumToHex } from '@irdashies/utils/colors';
import { RadarDisplay } from '../../../Radar/components/RadarDisplay';
import { useDemoRadarFrame } from '../../../Radar/hooks/useDemoRadarFrame';
import { demoAppearance } from '../../../Radar/radarDemo';
import { paler } from '../../../Radar/radarColors';
import { radarStyleFrom } from '../../../Radar/radarStyle';

/**
 * Demo cars that show off each section: the pack beside and ahead for close
 * cars, the diver for overlap and dive-bombs, the wreck for hazards. Other
 * sections show everything.
 */
const SCENE_CARS: Readonly<Record<string, readonly number[]>> = {
  warnings: [2, 3, 4],
  overlap: [1, 2],
  dive: [1],
  hazards: [5],
};

/** The demo pack drawn with the settings being edited. */
export const RadarPreview = ({
  config,
  scene = null,
}: {
  config: RadarConfig;
  /** Section open in the settings, to show only its part of the demo. */
  scene?: string | null;
}) => {
  const demo = useDemoRadarFrame(true);
  const frame = useMemo(() => {
    const only = scene ? SCENE_CARS[scene] : undefined;
    if (!demo || !only) return demo;
    return {
      ...demo,
      cars: demo.cars.filter((car) => only.includes(car.carIdx)),
      hazards: (demo.hazards ?? []).filter((hazard) =>
        only.includes(hazard.carIdx)
      ),
    };
  }, [demo, scene]);
  const size = useMemo(
    () => ({ length: config.carLength, width: config.carWidth }),
    [config.carLength, config.carWidth]
  );
  const playerFill = colorNumToHex(config.playerColor) ?? '#ffffff';
  const customFill =
    colorNumToHex(config.rivalCustomColor ?? undefined) ?? paler(playerFill);
  const appearance = useMemo(
    () => demoAppearance(config.rivalColorMode, customFill, size),
    [config.rivalColorMode, customFill, size]
  );
  const style = useMemo(() => radarStyleFrom(config, size), [config, size]);
  const dive = useMemo(
    () => ({
      enabled: config.showDiveWarning,
      minClosingKmh: config.diveMinClosingKmh,
      warnSeconds: config.diveWarnSeconds,
      cornerSide: false,
    }),
    [config.showDiveWarning, config.diveMinClosingKmh, config.diveWarnSeconds]
  );

  if (!frame) return null;
  return (
    <div
      className="w-44 h-44 shrink-0 rounded-md"
      style={{
        background:
          'repeating-linear-gradient(100deg, #3f4a3a 0 24px, #45503f 24px 52px)',
      }}
      aria-label="Radar preview"
    >
      <RadarDisplay
        frame={frame}
        appearance={appearance}
        geometry={null}
        style={style}
        extrapolationS={config.tuning.extrapolationS}
        laneGapM={config.tuning.laneGapM}
        dive={dive}
      />
    </div>
  );
};
