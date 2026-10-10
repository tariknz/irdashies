import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSimulator, IrSdkSourceBridge } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';
import type { SimDefinition } from './sims/types';

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const setup = vi.hoisted(() => ({ setActiveSimulator: vi.fn() }));
vi.mock('./setup', () => setup);

/**
 * A sim whose probe and bridge are both driven by hand: `probe.active` decides
 * what auto-detect sees while probing, and `emitRunningState` simulates the
 * attached bridge's own connect/disconnect events once selected.
 *
 * The replay on subscribe is what every real bridge does: each seeds its
 * running state while being built -- before auto-detect can subscribe -- and
 * then publishes only on a change, so without the replay a subscriber would
 * never learn the sim was up.
 */
function fakeSim(id: ActiveSimulator, priority: number) {
  const probe = { active: false, starts: 0, stops: 0 };
  let runningStateCallback: ((value: boolean) => void) | undefined;
  const bridge: IrSdkSourceBridge = {
    onTelemetry: () => () => undefined,
    onSessionData: () => () => undefined,
    onRunningState: (callback) => {
      runningStateCallback = callback;
      callback(true);
      return () => {
        runningStateCallback = undefined;
      };
    },
    stop: vi.fn(),
    changeCameraNumber: () => undefined,
    changeReplayPosition: () => undefined,
    triggerReplaySessionSearch: () => undefined,
  };
  const definition: SimDefinition = {
    id,
    priority,
    createProbe: async () => ({
      start: () => {
        probe.starts += 1;
      },
      isActive: () => probe.active,
      stop: () => {
        probe.stops += 1;
      },
    }),
    loadBridge: async () => async () => bridge,
  };
  return {
    definition,
    probe,
    bridge,
    emitRunningState: (value: boolean) => runningStateCallback?.(value),
  };
}

const overlayManager = {
  publishMessage: vi.fn(),
} as unknown as OverlayManager;

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('publishAutoDetectedSdkEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('selects the simulator that probes as active', async () => {
    const iracing = fakeSim('iracing', 100);
    const lmu = fakeSim('lmu', 90);
    iracing.probe.active = true;
    vi.doMock('./sims/registry', () => ({
      getSimDefinitions: () => [iracing.definition, lmu.definition],
    }));

    const { publishAutoDetectedSdkEvents } =
      await import('./autoDetectSdkBridge');
    await publishAutoDetectedSdkEvents(overlayManager);

    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'iracing'
      )
    );
    // Named once, and never cleared on the way -- clearing rebuilds every
    // overlay window, so the initial pick must cost exactly one write.
    expect(setup.setActiveSimulator.mock.calls).toEqual([
      [overlayManager, 'iracing'],
    ]);
  });

  it('switches to another simulator once the active one stops running', async () => {
    const iracing = fakeSim('iracing', 100);
    const lmu = fakeSim('lmu', 90);
    iracing.probe.active = true;
    vi.doMock('./sims/registry', () => ({
      getSimDefinitions: () => [iracing.definition, lmu.definition],
    }));

    const { publishAutoDetectedSdkEvents } =
      await import('./autoDetectSdkBridge');
    const facade = await publishAutoDetectedSdkEvents(overlayManager);
    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'iracing'
      )
    );

    const runningStates: boolean[] = [];
    facade.onRunningState((value) => runningStates.push(value));

    // iRacing closes; LMU has since started.
    iracing.probe.active = false;
    lmu.probe.active = true;
    iracing.emitRunningState(false);

    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'lmu'
      )
    );
    expect(iracing.bridge.stop).toHaveBeenCalled();
    // Straight from one sim to the other: no undefined in between, so the
    // overlays are rebuilt once rather than twice.
    expect(setup.setActiveSimulator.mock.calls).toEqual([
      [overlayManager, 'iracing'],
      [overlayManager, 'lmu'],
    ]);
    // The replay of the running iracing bridge, its disconnect, then the newly
    // attached lmu bridge connecting.
    expect(runningStates).toEqual([true, false, true]);
  });

  it('keeps the attached simulator when it comes back on its own', async () => {
    // Leaving an iRacing session drops the running state without the sim
    // closing. Tearing the bridge down for that would rebuild every overlay
    // window twice per session, to end up exactly where it started.
    const iracing = fakeSim('iracing', 100);
    const lmu = fakeSim('lmu', 90);
    iracing.probe.active = true;
    vi.doMock('./sims/registry', () => ({
      getSimDefinitions: () => [iracing.definition, lmu.definition],
    }));

    const { publishAutoDetectedSdkEvents } =
      await import('./autoDetectSdkBridge');
    await publishAutoDetectedSdkEvents(overlayManager);
    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'iracing'
      )
    );

    // Out to the sim's own UI, then back into a session. LMU never runs.
    iracing.emitRunningState(false);
    await settled();
    iracing.emitRunningState(true);
    await settled();

    expect(iracing.bridge.stop).not.toHaveBeenCalled();
    expect(setup.setActiveSimulator.mock.calls).toEqual([
      [overlayManager, 'iracing'],
    ]);
  });

  it('goes on naming a dead simulator when nothing replaces it', async () => {
    // The name is what widget filtering follows, and a pinned sim keeps its
    // name while closed. Auto has to behave the same, rather than un-hiding
    // every widget the moment the sim goes quiet. The settings header stops
    // showing it anyway, because that gates on the running state.
    const iracing = fakeSim('iracing', 100);
    const lmu = fakeSim('lmu', 90);
    iracing.probe.active = true;
    vi.doMock('./sims/registry', () => ({
      getSimDefinitions: () => [iracing.definition, lmu.definition],
    }));

    const { publishAutoDetectedSdkEvents } =
      await import('./autoDetectSdkBridge');
    const facade = await publishAutoDetectedSdkEvents(overlayManager);
    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'iracing'
      )
    );

    const runningStates: boolean[] = [];
    facade.onRunningState((value) => runningStates.push(value));

    // iRacing dies and nothing else is running.
    iracing.probe.active = false;
    iracing.emitRunningState(false);
    await settled();

    expect(setup.setActiveSimulator.mock.calls).toEqual([
      [overlayManager, 'iracing'],
    ]);
    expect(iracing.bridge.stop).not.toHaveBeenCalled();
    expect(runningStates).toEqual([true, false]);
  });

  it('does not go looking on a bridge reporting inactive before it ever connects', async () => {
    // Auto-detect chose this sim on its probe. A bridge that has not finished
    // connecting must not hand the session to a sim that lost the tie.
    const iracing = fakeSim('iracing', 100);
    const lmu = fakeSim('lmu', 90);
    iracing.probe.active = true;
    lmu.probe.active = true;
    // Replays `false` first, as a bridge that has not connected yet would.
    iracing.bridge.onRunningState = (callback) => {
      callback(false);
      return () => undefined;
    };
    vi.doMock('./sims/registry', () => ({
      getSimDefinitions: () => [iracing.definition, lmu.definition],
    }));

    const { publishAutoDetectedSdkEvents } =
      await import('./autoDetectSdkBridge');
    await publishAutoDetectedSdkEvents(overlayManager);
    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'iracing'
      )
    );
    await settled();

    expect(setup.setActiveSimulator.mock.calls).toEqual([
      [overlayManager, 'iracing'],
    ]);
    expect(iracing.bridge.stop).not.toHaveBeenCalled();
  });

  it('leaves the running simulator its own SDK handle while watching', async () => {
    // The attached sim is excluded from the watchdog's probing, so its live
    // bridge is not competing with a second handle on the same source.
    const iracing = fakeSim('iracing', 100);
    const lmu = fakeSim('lmu', 90);
    iracing.probe.active = true;
    vi.doMock('./sims/registry', () => ({
      getSimDefinitions: () => [iracing.definition, lmu.definition],
    }));

    const { publishAutoDetectedSdkEvents } =
      await import('./autoDetectSdkBridge');
    await publishAutoDetectedSdkEvents(overlayManager);
    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'iracing'
      )
    );

    const startsAfterDetection = iracing.probe.starts;
    iracing.emitRunningState(false);
    await settled();

    expect(iracing.probe.starts).toBe(startsAfterDetection);
    expect(lmu.probe.starts).toBeGreaterThan(0);
  });

  it('stops the watchdog probes when the facade is stopped', async () => {
    const iracing = fakeSim('iracing', 100);
    const lmu = fakeSim('lmu', 90);
    iracing.probe.active = true;
    vi.doMock('./sims/registry', () => ({
      getSimDefinitions: () => [iracing.definition, lmu.definition],
    }));

    const { publishAutoDetectedSdkEvents } =
      await import('./autoDetectSdkBridge');
    const facade = await publishAutoDetectedSdkEvents(overlayManager);
    await vi.waitFor(() =>
      expect(setup.setActiveSimulator).toHaveBeenCalledWith(
        overlayManager,
        'iracing'
      )
    );

    iracing.emitRunningState(false);
    await settled();
    const stopsWhileWatching = lmu.probe.stops;

    facade.stop();
    await settled();

    expect(lmu.probe.stops).toBeGreaterThan(stopsWhileWatching);
    expect(iracing.bridge.stop).toHaveBeenCalled();
  });
});
