import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __resetBrakeCueAudioForTests,
  playBrakeCue,
  primeBrakeCueAudio,
  setBrakeCueOutputDevice,
} from './brakeCueAudio';

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

interface RampCall {
  value: number;
  time: number;
}

class FakeParam {
  setValueCalls: RampCall[] = [];
  rampCalls: RampCall[] = [];
  value = 0;
  setValueAtTime(value: number, time: number) {
    this.setValueCalls.push({ value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.rampCalls.push({ value, time });
  }
}

class FakeOscillator {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start(at: number) {
    this.started = at;
  }
  stop(at: number) {
    this.stopped = at;
  }
}

class FakeGain {
  gain = new FakeParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  sinkIds: string[] = [];
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });

  setSinkId(sinkId: string) {
    this.sinkIds.push(sinkId);
    return Promise.resolve();
  }

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
}

const currentContext = () =>
  FakeAudioContext.instances[FakeAudioContext.instances.length - 1];

describe('brakeCueAudio', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    __resetBrakeCueAudioForTests();
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetBrakeCueAudioForTests();
  });

  it('does not open an audio device until something is played', () => {
    expect(FakeAudioContext.instances).toHaveLength(0);

    primeBrakeCueAudio();

    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('reuses one context across cues', () => {
    playBrakeCue('count3', 1);
    playBrakeCue('brake', 1);

    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('plays nothing at zero or invalid volume', () => {
    playBrakeCue('count3', 0);
    playBrakeCue('count3', -1);
    playBrakeCue('count3', NaN);

    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('uses one pitch for the beeps and a distinct tone for the brake point', () => {
    playBrakeCue('count3', 1);
    playBrakeCue('count2', 1);
    playBrakeCue('count1', 1);
    playBrakeCue('brake', 1);

    const oscillators = currentContext().oscillators;
    expect(oscillators.map((o) => o.frequency.value)).toEqual([
      880, 880, 880, 1100,
    ]);
    expect(oscillators.map((o) => o.type)).toEqual([
      'sine',
      'sine',
      'sine',
      'triangle',
    ]);
  });

  it('honours configured cues over the built-in defaults', () => {
    const cues = {
      count3: {
        frequency: 500,
        type: 'square' as const,
        durationSec: 0.1,
        peak: 1,
      },
      count2: {
        frequency: 500,
        type: 'square' as const,
        durationSec: 0.1,
        peak: 1,
      },
      count1: {
        frequency: 500,
        type: 'square' as const,
        durationSec: 0.1,
        peak: 1,
      },
      brake: {
        frequency: 1500,
        type: 'sawtooth' as const,
        durationSec: 0.2,
        peak: 0.5,
      },
    };
    playBrakeCue('count1', 1, cues);
    playBrakeCue('brake', 1, cues);

    const oscillators = currentContext().oscillators;
    expect(oscillators.map((o) => o.frequency.value)).toEqual([500, 1500]);
    expect(oscillators.map((o) => o.type)).toEqual(['square', 'sawtooth']);
  });

  it('never ramps the envelope to exactly zero', () => {
    // exponentialRampToValueAtTime throws on a zero target, and jumping to zero
    // clicks. This is the regression guard for both.
    playBrakeCue('brake', 1);

    const envelope = currentContext().gains[1];
    const targets = [
      ...envelope.gain.rampCalls.map((c) => c.value),
      ...envelope.gain.setValueCalls.map((c) => c.value),
    ];
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) expect(target).toBeGreaterThan(0);
  });

  it('scales the master gain by the requested volume', () => {
    playBrakeCue('count3', 1);
    const loud = currentContext().gains[0].gain.value;

    __resetBrakeCueAudioForTests();
    FakeAudioContext.instances = [];
    playBrakeCue('count3', 0.5);
    const quiet = currentContext().gains[0].gain.value;

    expect(quiet).toBeLessThan(loud);
    expect(loud).toBeLessThanOrEqual(1);
  });

  it('clamps a volume above the configured range', () => {
    playBrakeCue('count3', 99);
    const clamped = currentContext().gains[0].gain.value;

    __resetBrakeCueAudioForTests();
    FakeAudioContext.instances = [];
    playBrakeCue('count3', 1);

    expect(clamped).toBe(currentContext().gains[0].gain.value);
  });

  it('resumes a suspended context and still schedules the cue', () => {
    primeBrakeCueAudio();
    const ctx = currentContext();
    ctx.state = 'suspended';

    playBrakeCue('count1', 1);

    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0].started).not.toBeNull();
  });

  it('opens the context on the default device without a sink switch', () => {
    primeBrakeCueAudio();

    expect(currentContext().sinkIds).toEqual([]);
  });

  it('routes the context at a chosen output device', () => {
    primeBrakeCueAudio();

    setBrakeCueOutputDevice('headset-id');

    expect(currentContext().sinkIds).toEqual(['headset-id']);
  });

  it('applies a device chosen before any audio device was opened', () => {
    setBrakeCueOutputDevice('headset-id');

    playBrakeCue('count3', 1);

    expect(currentContext().sinkIds).toEqual(['headset-id']);
  });

  it('switches back to the system default as the empty sink id', () => {
    setBrakeCueOutputDevice('headset-id');
    primeBrakeCueAudio();

    setBrakeCueOutputDevice('default');

    expect(currentContext().sinkIds).toEqual(['headset-id', '']);
  });

  it('does not re-route when the same device is selected again', () => {
    primeBrakeCueAudio();

    setBrakeCueOutputDevice('headset-id');
    setBrakeCueOutputDevice('headset-id');

    expect(currentContext().sinkIds).toEqual(['headset-id']);
  });

  it('still plays when the selected device is gone', async () => {
    class MissingDeviceContext extends FakeAudioContext {
      override setSinkId(): Promise<void> {
        return Promise.reject(new Error('device not found'));
      }
    }
    vi.stubGlobal('AudioContext', MissingDeviceContext);
    setBrakeCueOutputDevice('unplugged-id');

    expect(() => playBrakeCue('count3', 1)).not.toThrow();
    await Promise.resolve();
    expect(currentContext().oscillators).toHaveLength(1);
  });

  it('no-ops instead of throwing when Web Audio is unavailable', () => {
    vi.unstubAllGlobals();
    __resetBrakeCueAudioForTests();
    vi.stubGlobal('AudioContext', undefined);

    expect(() => playBrakeCue('brake', 1)).not.toThrow();
    expect(() => primeBrakeCueAudio()).not.toThrow();
  });

  it('survives an audio device that throws', () => {
    class BrokenContext extends FakeAudioContext {
      override createOscillator(): FakeOscillator {
        throw new Error('device gone');
      }
    }
    vi.stubGlobal('AudioContext', BrokenContext);

    expect(() => playBrakeCue('count3', 1)).not.toThrow();
  });
});
