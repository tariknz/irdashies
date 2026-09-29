import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  CarLeftRight,
  SessionState,
  defaultDashboard,
  type ChannelBridge,
  type ChannelName,
  type ChannelPayloads,
  type DashboardLayout,
  type RadarConfig,
  type RadarSnapshot,
} from '@irdashies/types';
import { mountFixture } from '../../../testing/renderWithFixture';
import type { ReplayFixture } from '../../../testing/replayFixture';
import roadAmerica from '../../../../test-data/fixtures/multiclass-road-america.json';
import { getClassColorHex } from '@irdashies/utils/colors';
import type { RadarDisplayProps } from './components/RadarDisplay';

/**
 * The disc is a canvas, which jsdom cannot rasterise, so the display is
 * replaced by a recorder: the props handed to it ARE the widget's output, and
 * the canvas itself is verified in Storybook against a real browser.
 */
const rendered: RadarDisplayProps[] = [];
vi.mock('./components/RadarDisplay', () => ({
  RadarDisplay: (props: RadarDisplayProps) => {
    rendered.push(props);
    return <canvas data-testid="radar-canvas" />;
  },
}));

import { Radar } from './Radar';

const fixture = roadAmerica as unknown as ReplayFixture;
const TRACK_LENGTH_M = 6413.5;

const radarDashboard = (config: Partial<RadarConfig>): DashboardLayout => {
  const dashboard = defaultDashboard as unknown as DashboardLayout;
  const defaults = dashboard.widgets.find((widget) => widget.id === 'radar');
  if (!defaults) throw new Error('default dashboard has no radar widget');
  return {
    ...dashboard,
    widgets: [
      {
        ...defaults,
        enabled: true,
        // This capture was recorded for standings and carries no IsOnTrack, so
        // the on-track gate would hide the disc before any blip is placed. The
        // gate itself is covered by its own test below.
        config: {
          ...defaults.config,
          showOnlyWhenOnTrack: false,
          ...config,
        },
      },
    ],
  } as DashboardLayout;
};

const latest = () => {
  const props = rendered.at(-1);
  if (!props) throw new Error('radar rendered no display');
  return props;
};

/**
 * The radar fades in, so a display does not exist on the first render: the
 * appearance has to be waited for rather than read straight after `render`.
 */
const waitForDisplay = async () =>
  waitFor(() => expect(rendered.length).toBeGreaterThan(0));

const waitForHidden = async () =>
  waitFor(() => expect(screen.queryByTestId('radar-canvas')).toBeNull());

/**
 * Makes the harness bridge hand the widget a fresh radar payload on every
 * delivery, the way the IPC boundary does. The processor fills one snapshot
 * object in place, so without this every seek republishes the very arrays the
 * hook already holds and the selector equality — correctly — sees no change.
 */
const cloneRadarDeliveriesPerFrame = () => {
  const bridge: ChannelBridge = window.channelBridge;
  window.channelBridge = {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void,
      requestedRateHz?: number
    ) =>
      bridge.subscribe(
        channel,
        (delivered) => {
          if (channel !== 'radar.snapshot') {
            callback(delivered);
            return;
          }
          const snapshot = delivered as RadarSnapshot;
          callback({
            ...snapshot,
            carIdxLapDistPct: [...snapshot.carIdxLapDistPct],
            carIdxOnPitRoad: [...snapshot.carIdxOnPitRoad],
          } as unknown as ChannelPayloads[K]);
        },
        requestedRateHz
      ),
  };
};

const finalFrame = () => {
  const frame = fixture.frames.at(-1);
  if (!frame) throw new Error('fixture has no frames');
  return frame;
};

/**
 * The recorded capture with its nearest rival re-placed at each given gap in
 * metres, one frame per gap. Everything else about the session stays real, so
 * the gate sees the same field and track the app would.
 *
 * The player index comes from a probe mount of the unmodified capture: the
 * harness resolves it from the session exactly as the app does, and guessing
 * it gets the player wrong.
 */
const fixtureWithRivalAt = (gapsM: readonly number[]): ReplayFixture => {
  const probe = mountFixture(fixture);
  const playerCarIdx = probe.focusCarIdx;
  const base = finalFrame();
  const positions = base.CarIdxLapDistPct as number[];
  const playerPct = positions[playerCarIdx];
  if (typeof playerPct !== 'number' || playerPct < 0) {
    throw new Error('fixture player has no position');
  }
  let rivalCarIdx = -1;
  let bestDelta = Infinity;
  for (let carIdx = 0; carIdx < positions.length; carIdx += 1) {
    if (carIdx === playerCarIdx) continue;
    const pct = positions[carIdx];
    if (typeof pct !== 'number' || pct < 0) continue;
    let delta = Math.abs(pct - playerPct);
    if (delta > 0.5) delta = 1 - delta;
    if (delta < bestDelta) {
      bestDelta = delta;
      rivalCarIdx = carIdx;
    }
  }
  if (rivalCarIdx < 0) throw new Error('fixture has no rival near the player');

  return {
    ...fixture,
    frames: gapsM.map((gapM) => ({
      ...base,
      CarIdxLapDistPct: positions.map((pct, carIdx) =>
        carIdx === rivalCarIdx ? playerPct + gapM / TRACK_LENGTH_M : pct
      ),
    })),
  };
};

const fixtureWithRadarOverlap = (
  cameraCarIdx: number,
  speed: number
): ReplayFixture => {
  const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
  const rivalCarIdx = fixture.drivers
    .map((driver) => Number(driver.CarIdx))
    .find((carIdx) => carIdx !== playerCarIdx);
  if (!Number.isInteger(playerCarIdx) || rivalCarIdx === undefined) {
    throw new Error('fixture has no player and rival');
  }

  const overlapCarIdx =
    cameraCarIdx === playerCarIdx ? rivalCarIdx : playerCarIdx;
  const positions = finalFrame().CarIdxLapDistPct as number[];
  const cameraPct = positions[cameraCarIdx];
  if (typeof cameraPct !== 'number' || cameraPct < 0) {
    throw new Error('camera car has no position');
  }

  return {
    ...fixture,
    frames: [
      {
        ...finalFrame(),
        CamCarIdx: cameraCarIdx,
        Speed: speed,
        CarLeftRight: CarLeftRight.CarLeft,
        CarIdxLapDistPct: positions.map((_, carIdx) =>
          carIdx === cameraCarIdx
            ? cameraPct
            : carIdx === overlapCarIdx
              ? cameraPct + 0.3 / TRACK_LENGTH_M
              : -1
        ),
      },
    ],
  };
};

const fixtureWithPlayerOnTwoWideGrid = (
  playerCarIdx: number,
  partnerCarIdx: number,
  sessionState = SessionState.GetInCar,
  partnerOnRoad = true
): ReplayFixture => {
  const base = finalFrame();
  const positions = base.CarIdxLapDistPct as number[];
  const playerPct = positions[playerCarIdx];
  if (typeof playerPct !== 'number' || playerPct < 0) {
    throw new Error('fixture player has no position');
  }

  return {
    ...fixture,
    frames: [
      {
        ...base,
        CamCarIdx: playerCarIdx,
        CarLeftRight: CarLeftRight.Clear,
        SessionState: sessionState,
        Speed: 0,
        CarIdxLapDistPct: positions.map((pct, carIdx) =>
          carIdx === partnerCarIdx
            ? partnerOnRoad
              ? playerPct + 0.5 / TRACK_LENGTH_M
              : -1
            : pct
        ),
        CarIdxPaceRow: positions.map((_, carIdx) =>
          carIdx === playerCarIdx || carIdx === partnerCarIdx ? 0 : -1
        ),
        CarIdxPaceLine: positions.map((_, carIdx) =>
          carIdx === playerCarIdx ? 0 : carIdx === partnerCarIdx ? 1 : -1
        ),
      },
    ],
  };
};

/**
 * Two frames of the same session: a rival 0.5 m behind the player in a full
 * field, then the same rival 0.5 m ahead in a field one car shorter. The
 * shorter car array is what changes the field size, and the rival's drawn
 * direction is what shows whether the previous frame's per-car state was
 * carried across it.
 */
const fixtureAcrossAFieldChange = (): ReplayFixture => {
  const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
  const rivalCarIdx = fixture.drivers
    .map((driver) => Number(driver.CarIdx))
    .find((carIdx) => carIdx !== playerCarIdx);
  if (!Number.isInteger(playerCarIdx) || rivalCarIdx === undefined) {
    throw new Error('fixture has no player and rival');
  }
  const positions = finalFrame().CarIdxLapDistPct as number[];
  const playerPct = positions[playerCarIdx];
  const rivalPct = positions[rivalCarIdx];
  if (typeof playerPct !== 'number' || typeof rivalPct !== 'number') {
    throw new Error('the player or the rival has no position');
  }
  const offsetM = 0.5 / TRACK_LENGTH_M;
  return {
    ...fixture,
    frames: [
      {
        ...finalFrame(),
        Speed: 20,
        CarLeftRight: CarLeftRight.Clear,
        CarIdxLapDistPct: positions.map((_, carIdx) =>
          carIdx === playerCarIdx
            ? playerPct
            : carIdx === rivalCarIdx
              ? playerPct - offsetM
              : -1
        ),
      },
      {
        ...finalFrame(),
        Speed: 20,
        CarLeftRight: CarLeftRight.Clear,
        // One car shorter than the frame before, with the rival now ahead. The
        // shorter field still has to hold both cars, or the player would be
        // off the road and the radar would blank for a different reason.
        CarIdxLapDistPct: positions
          .slice(0, Math.max(playerCarIdx, rivalCarIdx) + 1)
          .map((_, carIdx) =>
            carIdx === playerCarIdx
              ? playerPct
              : carIdx === rivalCarIdx
                ? playerPct + offsetM
                : -1
          ),
      },
    ],
  };
};

describe('Radar widget over a recorded multiclass session', () => {
  beforeEach(() => {
    rendered.length = 0;
  });

  it('places blips at the distances the recorded positions describe', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({ radarRange: 25 }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    const props = latest();
    expect(props.blips.length).toBeGreaterThan(0);

    const positions = finalFrame().CarIdxLapDistPct as number[];
    const playerPct = positions[harness.focusCarIdx];
    if (playerPct === undefined) throw new Error('player has no position');

    // Independent expectation: the same signed lap-distance delta the widget
    // claims to use, computed straight from the recorded frame.
    for (const blip of props.blips) {
      let delta = positions[blip.carIdx] - playerPct;
      if (delta > 0.5) delta -= 1;
      else if (delta < -0.5) delta += 1;
      expect(blip.alongM).toBeCloseTo(delta * TRACK_LENGTH_M, 3);
      expect(Math.abs(blip.alongM)).toBeLessThanOrEqual(25);
    }
  });

  it('clears overlap markers when the stationary player is on the grid', async () => {
    const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
    const rivalCarIdx = fixture.drivers
      .map((driver) => Number(driver.CarIdx))
      .find((carIdx) => carIdx !== playerCarIdx);
    if (rivalCarIdx === undefined) throw new Error('fixture has no rival');
    const harness = mountFixture(fixtureWithRadarOverlap(playerCarIdx, 0), {
      dashboard: radarDashboard({ fadeSeconds: 0 }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(
      latest().blips.find((blip) => blip.carIdx === rivalCarIdx)
    ).toMatchObject({ side: null, rimSignal: null });
  });

  it('places the player and grid partner in their sim-reported columns', async () => {
    const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
    const partnerCarIdx = fixture.drivers
      .map((driver) => Number(driver.CarIdx))
      .find((carIdx) => carIdx !== playerCarIdx);
    if (!Number.isInteger(playerCarIdx) || partnerCarIdx === undefined) {
      throw new Error('fixture has no player and grid partner');
    }

    const harness = mountFixture(
      fixtureWithPlayerOnTwoWideGrid(playerCarIdx, partnerCarIdx),
      { dashboard: radarDashboard({ fadeSeconds: 0 }) }
    );
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(latest().playerLateralM).toBe(-2.5);
    const partner = latest().blips.find(
      (blip) => blip.carIdx === partnerCarIdx
    );
    if (!partner || partner.gridLaneOffsetM === undefined) {
      throw new Error('grid partner was not assigned a lane');
    }
    expect(partner.gridLaneOffsetM).toBeCloseTo(2.5, 5);
    expect(partner.alongM).toBeCloseTo(0, 3);
    expect(partner.gapM).toBeCloseTo(0, 3);
    expect(partner.side).toBeNull();
    expect(partner.rimSignal).toBeNull();
    expect(partner.drawLateralM).toBeCloseTo(
      partner.lateralM + partner.gridLaneOffsetM,
      6
    );
  });

  it('uses pace lines to keep the grid when one lane lacks a road position', async () => {
    const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
    const partnerCarIdx = fixture.drivers
      .map((driver) => Number(driver.CarIdx))
      .find((carIdx) => carIdx !== playerCarIdx);
    if (!Number.isInteger(playerCarIdx) || partnerCarIdx === undefined) {
      throw new Error('fixture has no player and grid partner');
    }

    const harness = mountFixture(
      fixtureWithPlayerOnTwoWideGrid(
        playerCarIdx,
        partnerCarIdx,
        SessionState.GetInCar,
        false
      ),
      { dashboard: radarDashboard({ fadeSeconds: 0 }) }
    );
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(latest().playerLateralM).toBe(-2.5);
    expect(latest().blips.some((blip) => blip.carIdx === partnerCarIdx)).toBe(
      false
    );
  });

  it('uses active pace rows when the stationary player reports racing state', async () => {
    const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
    const partnerCarIdx = fixture.drivers
      .map((driver) => Number(driver.CarIdx))
      .find((carIdx) => carIdx !== playerCarIdx);
    if (!Number.isInteger(playerCarIdx) || partnerCarIdx === undefined) {
      throw new Error('fixture has no player and grid partner');
    }

    const harness = mountFixture(
      fixtureWithPlayerOnTwoWideGrid(
        playerCarIdx,
        partnerCarIdx,
        SessionState.Racing
      ),
      { dashboard: radarDashboard({ fadeSeconds: 0 }) }
    );
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(latest().playerLateralM).toBe(-2.5);
    const partner = latest().blips.find(
      (blip) => blip.carIdx === partnerCarIdx
    );
    if (!partner || partner.gridLaneOffsetM === undefined) {
      throw new Error('grid partner was not assigned a lane');
    }
    expect(partner.alongM).toBeCloseTo(0, 3);
    expect(partner.drawLateralM).toBeCloseTo(
      partner.lateralM + partner.gridLaneOffsetM,
      6
    );
  });

  it('keeps overlap markers when the player is moving', async () => {
    const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
    const rivalCarIdx = fixture.drivers
      .map((driver) => Number(driver.CarIdx))
      .find((carIdx) => carIdx !== playerCarIdx);
    if (rivalCarIdx === undefined) throw new Error('fixture has no rival');
    const harness = mountFixture(fixtureWithRadarOverlap(playerCarIdx, 12), {
      dashboard: radarDashboard({ fadeSeconds: 0 }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(
      latest().blips.find((blip) => blip.carIdx === rivalCarIdx)
    ).toMatchObject({ side: -1, rimSignal: 'left' });
  });

  it('does not infer a watched car is on the grid from player speed', async () => {
    const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
    const cameraCarIdx = fixture.drivers
      .map((driver) => Number(driver.CarIdx))
      .find((carIdx) => carIdx !== playerCarIdx);
    if (cameraCarIdx === undefined) throw new Error('fixture has no rival');
    const harness = mountFixture(fixtureWithRadarOverlap(cameraCarIdx, 0), {
      dashboard: radarDashboard({ fadeSeconds: 0 }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(
      latest().blips.find((blip) => blip.carIdx === playerCarIdx)
    ).toMatchObject({ side: -1, rimSignal: 'left' });
  });

  it('does not carry a car drawn behind into a session with a smaller field', async () => {
    const playerCarIdx = Number(fixture.driverInfo?.DriverCarIdx);
    const rivalCarIdx = fixture.drivers
      .map((driver) => Number(driver.CarIdx))
      .find((carIdx) => carIdx !== playerCarIdx);
    if (rivalCarIdx === undefined) throw new Error('fixture has no rival');
    const harness = mountFixture(fixtureAcrossAFieldChange(), {
      dashboard: radarDashboard({ radarRange: 25, fadeSeconds: 0 }),
      // Stop on the first frame so the transition happens while the widget is
      // mounted, with the first frame's state actually carried into it.
      warmFrames: 1,
    });
    // The processors fill one snapshot object in place and the harness installs
    // its bridge when it mounts, so this has to wrap that bridge rather than
    // precede it. Over IPC every frame arrives as a fresh payload, which is
    // what the widget's selector equality is written against; without a copy,
    // the seek hands the hook the very array it already holds and no frame is
    // ever seen as a change.
    cloneRadarDeliveriesPerFrame();
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();
    expect(
      latest().blips.find((b) => b.carIdx === rivalCarIdx)?.alongM
    ).toBeCloseTo(-0.5, 3);

    act(() => {
      harness.seekTo(1);
    });

    // The rival is now ahead of the player, in a field one car shorter. Car
    // indices are re-used between sessions, so the per-car state has to be
    // dropped when the field size changes: kept, the latch would hold a car
    // that is now in front on the side it was last drawn on, and the blip would
    // read -0.5 m instead of +0.5 m.
    const blip = latest().blips.find((b) => b.carIdx === rivalCarIdx);
    if (!blip) throw new Error('the rival left the radar');
    expect(blip.alongM).toBeCloseTo(0.5, 3);
  });

  it('uses class and badge colours when selected', async () => {
    const classHarness = mountFixture(fixture, {
      dashboard: radarDashboard({ rivalColorMode: 'class' }),
    });
    const classView = render(<Radar />, { wrapper: classHarness.wrapper });
    await waitForDisplay();
    const classColors = new Map(
      fixture.drivers.map((driver) => [Number(driver.CarIdx), driver])
    );
    for (const blip of latest().blips) {
      const value = Number(classColors.get(blip.carIdx)?.CarClassColor ?? 0);
      expect(blip.color).toBe(getClassColorHex(value, true, '#cbd5e1'));
    }
    classView.unmount();

    rendered.length = 0;
    const badgeHarness = mountFixture(fixture, {
      dashboard: radarDashboard({ rivalColorMode: 'badge' }),
    });
    render(<Radar />, { wrapper: badgeHarness.wrapper });
    await waitForDisplay();
    const badgeColors: Record<string, string> = {
      W: '#71717a',
      P: '#7e22ce',
      A: '#1d4ed8',
      B: '#15803d',
      C: '#a16207',
      D: '#c2410c',
      R: '#b91c1c',
    };
    for (const blip of latest().blips) {
      const driver = classColors.get(blip.carIdx);
      const license = String(driver?.LicString ?? '').charAt(0);
      expect(blip.color).toBe(badgeColors[license] ?? null);
    }
  });

  it('keeps custom opponent colour free of session colours', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({ rivalColorMode: 'custom' }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();
    expect(latest().blips.every((blip) => !blip.color)).toBe(true);
  });

  it('labels blips with the car number from the session', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({ radarRange: 25 }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    const numbered = latest().blips.filter((blip) => blip.carNumber !== null);
    expect(numbered.length).toBeGreaterThan(0);
    expect(numbered[0].carNumber).toMatch(/\d/);
  });

  it('renders nothing when the session type is switched off', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({
        radarRange: 25,
        sessionVisibility: {
          race: false,
          loneQualify: false,
          openQualify: false,
          practice: false,
          offlineTesting: false,
        },
      }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForHidden();

    expect(rendered).toHaveLength(0);
  });

  it('passes the configured range and colours through to the disc', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({
        radarRange: 12,
        colorRival: '#ff00ff',
      }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(latest()).toMatchObject({
      radarRange: 12,
      colorRival: '#ff00ff',
    });
    for (const blip of latest().blips) {
      expect(Math.abs(blip.alongM)).toBeLessThanOrEqual(12);
    }
  });

  it('passes the track-map settings and radar state to the display', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({
        radarRange: 25,
        showTrackMap: true,
        mapBorderColor: '#112233',
        mapBorderOpacity: 85,
        mapFillColor: '#abcdef',
        mapFillOpacity: 35,
        fadeSeconds: 0,
      }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    const display = latest();
    expect(display.showFollowingMap).toBe(true);
    expect(display).toMatchObject({
      followingMapBorderColor: '#112233',
      followingMapBorderOpacity: 85,
      followingMapFillColor: '#abcdef',
      followingMapFillOpacity: 35,
    });
    expect(display.followingMapWindowM).toBe(75);
    expect(display.followingMapPath).toBeInstanceOf(Float64Array);
    expect(display.followingMapPointCount).toBeGreaterThanOrEqual(0);
    expect(display.followingMapPointCount * 2).toBeLessThanOrEqual(
      display.followingMapPath.length
    );
  });

  it('hides the disc while the session reports the car off track', async () => {
    // The capture has no IsOnTrack, so the sim state reads as off track and the
    // on-track gate — left at its default of on — must suppress the disc.
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({
        radarRange: 25,
        showOnlyWhenOnTrack: true,
      }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForHidden();

    expect(rendered).toHaveLength(0);
  });

  it('keeps the radar off screen while every car is beyond the near range', async () => {
    // The capture's only car in range sits 2.6 m back, so a 1 m near range
    // must leave the radar hidden.
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({
        radarRange: 25,
        showWhenNearby: true,
        showRange: 1,
        fadeSeconds: 0,
      }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForHidden();

    expect(rendered).toHaveLength(0);
  });

  it('brings the radar on screen once a car is inside the near range', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({
        radarRange: 25,
        showWhenNearby: true,
        showRange: 5,
        fadeSeconds: 0,
      }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    expect(latest().blips.length).toBeGreaterThan(0);
  });

  it('will not bring the panel on for a car sitting at the clipping edge', async () => {
    // A profile that sets the near range equal to the radar range — the shape
    // the live profile has — must not bring the panel on for a car in the last
    // half metre before the edge: that car is at the clip boundary, where the
    // disc shows almost nothing of it. The panel has to wait for a car that is
    // actually inside the view.
    const RADAR_RANGE = 25;
    const config = {
      radarRange: RADAR_RANGE,
      showWhenNearby: true,
      showRange: RADAR_RANGE,
      fadeSeconds: 0,
    };

    const atEdge = mountFixture(fixtureWithRivalAt([RADAR_RANGE - 0.25]), {
      dashboard: radarDashboard(config),
    });
    render(<Radar />, { wrapper: atEdge.wrapper });
    await waitForHidden();

    const inside = mountFixture(fixtureWithRivalAt([RADAR_RANGE - 3]), {
      dashboard: radarDashboard(config),
    });
    render(<Radar />, { wrapper: inside.wrapper });
    await waitForDisplay();
  });

  it('does not re-render the display when a snapshot repeats the same input', async () => {
    const harness = mountFixture(fixture, {
      dashboard: radarDashboard({ radarRange: 25 }),
    });
    render(<Radar />, { wrapper: harness.wrapper });
    await waitForDisplay();

    const renders = rendered.length;
    act(() => {
      harness.seekTo(fixture.frames.length - 1);
      harness.seekTo(fixture.frames.length - 1);
    });

    // The delivery carries the same selected input as the settled frame, so
    // radarInputEqual must keep the display from rendering again.
    expect(rendered.length).toBe(renders);
  });

  it('brings the panel on screen once at a jittering show-range boundary', async () => {
    // A rival holding the show range itself, with the ±0.3 m the measured
    // gap jitters by: `nearestGapM` crosses the boundary on every other
    // frame, so a plain `<= showRange` gate flips the whole panel on and off
    // for as long as the car sits there. The hysteresis must bring it on
    // screen once and keep it there until the car is past the range plus its
    // margin. Asserted on what Radar renders, frame by frame, not on the
    // internal gap.
    const SHOW_RANGE_M = 10;
    // Metres from the player: beyond the release margin, then the boundary
    // with jitter, then clear of the margin again. Consecutive frames differ
    // so every delivery re-renders.
    const GAPS_M = [12, 9.7, 10.3, 9.7, 10.4, 10.3, 9.7, 10.9, 10.2, 9.8, 12];

    // The recorded capture with one rival re-placed per frame: everything
    // else about the session stays real.
    const jittered = fixtureWithRivalAt(GAPS_M);

    const harness = mountFixture(jittered, {
      dashboard: radarDashboard({
        radarRange: 25,
        showWhenNearby: true,
        showRange: SHOW_RANGE_M,
        fadeSeconds: 0,
      }),
    });
    // The processors fill their snapshot in place, so the harness republishes
    // one object per channel for the whole run. Over IPC every frame arrives
    // as a fresh payload, which is what the widget's selector equality is
    // written against; without that, a seek hands the hook the very array it
    // already holds and no frame is ever seen as a change.
    cloneRadarDeliveriesPerFrame();
    render(<Radar />, { wrapper: harness.wrapper });
    // The mount plays every frame and ends on the last one, which sits beyond
    // the release margin: the panel starts hidden.
    await waitForHidden();
    expect(rendered).toHaveLength(0);

    const onScreen: boolean[] = [];
    for (let index = 0; index < GAPS_M.length; index += 1) {
      act(() => {
        harness.seekTo(index);
      });
      onScreen.push(screen.queryByTestId('radar-canvas') !== null);
    }

    // On at the first jitter frame inside the range, and still on for every
    // frame that only jittered past the boundary: one appearance, no flip.
    const appearances = onScreen.filter(
      (shown, index) => shown && index > 0 && !onScreen[index - 1]
    ).length;
    const disappearances = onScreen.filter(
      (shown, index) => !shown && index > 0 && onScreen[index - 1]
    ).length;
    expect(appearances).toBe(1);
    expect(onScreen.slice(1, -1).every((shown) => shown)).toBe(true);
    // The final frame is clear of the margin, so the gate does release —
    // exactly once, at the end, not through the jitter.
    expect(disappearances).toBe(1);
    expect(onScreen.at(-1)).toBe(false);
  });
});
