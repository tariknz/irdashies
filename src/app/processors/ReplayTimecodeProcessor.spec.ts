import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import {
  ReplayTimecodeProcessor,
  LIVE_EDGE_FRAMES,
} from './ReplayTimecodeProcessor';

const frame = (overrides: Record<string, unknown> = {}): Telemetry => {
  const defaults: Record<string, unknown> = {
    IsReplayPlaying: true,
    ReplayFrameNum: 1000,
    ReplayFrameNumEnd: 10000,
    ReplayPlaySpeed: 1,
    ReplayPlaySlowMotion: false,
    ReplaySessionTime: 100.0,
    ReplaySessionNum: 0,
    CamCarIdx: 0,
    CamGroupNumber: 1,
    CamCameraNumber: 1,
  };
  const merged = { ...defaults, ...overrides };
  const telemetry: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) {
    telemetry[k] = { value: [v] };
  }
  return telemetry as unknown as Telemetry;
};

describe('ReplayTimecodeProcessor', () => {
  it('scrub follows on program', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame({ ReplaySessionTime: 60.0 }));
    const snap = p.snapshot();
    expect(snap.active).toBe(true);
    expect(snap.sessionTime).toBe(60);
    expect(snap.program.state).toBe('onProgram');
    expect(snap.program.sessionTime).toBe(60);
  });

  it('30s at 1x advances program 30s', () => {
    let nowMs = 0;
    const p = new ReplayTimecodeProcessor(() => nowMs);
    p.onFrame(frame({ ReplaySessionTime: 100.0 }));
    p.cut();
    nowMs = 30_000;
    p.onFrame(frame({ ReplaySessionTime: 50.0 }));
    const snap = p.snapshot();
    expect(snap.program.state).toBe('cutAway');
    expect(snap.program.sessionTime).toBe(130);
  });

  it('paused cut does not advance program', () => {
    let nowMs = 0;
    const p = new ReplayTimecodeProcessor(() => nowMs);
    p.onFrame(frame({ ReplayPlaySpeed: 0 }));
    p.cut();
    nowMs = 10_000;
    p.onFrame(frame({ ReplayPlaySpeed: 0 }));
    const snap = p.snapshot();
    expect(snap.program.sessionTime).toBe(100);
  });

  it('4x speed advances program at 4x', () => {
    let nowMs = 0;
    const p = new ReplayTimecodeProcessor(() => nowMs);
    p.onFrame(frame({ ReplayPlaySpeed: 4 }));
    p.cut();
    nowMs = 10_000;
    p.onFrame(frame());
    const snap = p.snapshot();
    expect(snap.program.sessionTime).toBe(140);
  });

  it('slow motion 4x uses 1/speed', () => {
    let nowMs = 0;
    const p = new ReplayTimecodeProcessor(() => nowMs);
    p.onFrame(frame({ ReplayPlaySpeed: 4, ReplayPlaySlowMotion: true }));
    p.cut();
    nowMs = 8_000;
    p.onFrame(frame({ ReplayPlaySpeed: 4, ReplayPlaySlowMotion: true }));
    const snap = p.snapshot();
    expect(snap.program.sessionTime).toBe(102);
  });

  it('second cut keeps the first cue', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame({ ReplayFrameNum: 1000 }));
    p.cut();
    const cue1 = p.getCue();
    p.onFrame(frame({ ReplayFrameNum: 2000 }));
    p.cut();
    const cue2 = p.getCue();
    expect(cue2?.frame).toBe(cue1?.frame);
  });

  it('programTarget clamps to frameEnd', () => {
    let nowMs = 0;
    const p = new ReplayTimecodeProcessor(() => nowMs);
    p.onFrame(frame({ ReplayFrameNum: 9990, ReplayFrameNumEnd: 10000 }));
    for (let i = 0; i < 5; i++) {
      p.onFrame(
        frame({
          ReplayFrameNum: 9990 + i * 60,
          ReplayFrameNumEnd: 10000,
          ReplaySessionTime: 100.0 + i,
        })
      );
    }
    p.onFrame(frame({ ReplayFrameNum: 9990, ReplayFrameNumEnd: 10000 }));
    p.cut();
    nowMs = 1000;
    const target = p.programTarget();
    expect(target?.frame).toBeLessThanOrEqual(10000);
  });

  it('atLiveEdge when frame >= frameEnd - LIVE_EDGE_FRAMES', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame({ ReplayFrameNum: 9941, ReplayFrameNumEnd: 10001 }));
    expect(p.snapshot().atLiveEdge).toBe(true);
  });

  it('not atLiveEdge when further back', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame({ ReplayFrameNum: 9000, ReplayFrameNumEnd: 10000 }));
    expect(p.snapshot().atLiveEdge).toBe(false);
  });

  it('LIVE_EDGE_FRAMES boundary check', () => {
    expect(LIVE_EDGE_FRAMES).toBe(60);
  });

  it('fps converges after 2s window', () => {
    const p = new ReplayTimecodeProcessor();
    for (let i = 0; i < 10; i++) {
      p.onFrame(frame({ ReplayFrameNum: i * 30, ReplaySessionTime: i * 0.5 }));
    }
    expect(p.fps_()).toBeCloseTo(60, 0);
  });

  it('lifecycle enter clears cue', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame());
    p.cut();
    expect(p.getCue()).not.toBeNull();
    p.onLifecycle({ type: 'enter' });
    expect(p.getCue()).toBeNull();
  });

  it('lifecycle disconnect clears cue and sets inactive', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame());
    p.cut();
    p.onLifecycle({ type: 'disconnect' });
    expect(p.getCue()).toBeNull();
    expect(p.snapshot().active).toBe(false);
  });

  it('lifecycle sessionNumChange keeps cue', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame());
    p.cut();
    const cue = p.getCue();
    p.onLifecycle({ type: 'sessionNumChange' });
    expect(p.getCue()).toBe(cue);
  });

  it('returned clears cue and restores onProgram', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame());
    p.cut();
    p.returned();
    expect(p.getCue()).toBeNull();
    expect(p.snapshot().program.state).toBe('onProgram');
  });

  it('snapshot inactive when not playing', () => {
    const p = new ReplayTimecodeProcessor();
    p.onFrame(frame({ IsReplayPlaying: false }));
    expect(p.snapshot().active).toBe(false);
  });

  it('offsetSeconds is negative when scrubbed behind advancing program', () => {
    let nowMs = 0;
    const p = new ReplayTimecodeProcessor(() => nowMs);
    p.onFrame(frame({ ReplaySessionTime: 100.0 }));
    p.cut();
    nowMs = 20_000;
    p.onFrame(frame({ ReplaySessionTime: 50.0 }));
    const snap = p.snapshot();
    // viewer is at 50s, program advanced to 120s → offset = 50 - 120 = -70
    expect(snap.program.offsetSeconds).toBeLessThan(0);
  });
});
