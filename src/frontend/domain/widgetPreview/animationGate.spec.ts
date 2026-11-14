import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installAnimationGate, type AnimationClock } from './animationGate';

/**
 * A window's animation frames, run one frame at a time with `tick`, and its
 * timers, which are Vitest's fake ones.
 */
function fakeWindow(document?: Document) {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = ++next;
    pending.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => {
    pending.delete(id);
  });
  const target: AnimationClock = {
    requestAnimationFrame: request as (
      callback: FrameRequestCallback
    ) => number,
    cancelAnimationFrame: cancel as (id: number) => void,
    setTimeout: globalThis.setTimeout.bind(
      globalThis
    ) as unknown as AnimationClock['setTimeout'],
    clearTimeout: globalThis.clearTimeout.bind(
      globalThis
    ) as unknown as AnimationClock['clearTimeout'],
    setInterval: globalThis.setInterval.bind(
      globalThis
    ) as unknown as AnimationClock['setInterval'],
    document,
  };
  const tick = (time = 16) => {
    const due = [...pending.values()];
    pending.clear();
    for (const callback of due) callback(time);
  };
  return { target, pending, request, cancel, tick };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('preview animation gate: timers and CSS', () => {
  it('skips an interval while paused and carries it on when resumed', () => {
    const { target } = fakeWindow();
    const gate = installAnimationGate(target);
    const tick = vi.fn();
    const id = target.setInterval(tick, 50);
    vi.advanceTimersByTime(100);
    expect(tick).toHaveBeenCalledTimes(2);
    gate.pause();
    vi.advanceTimersByTime(500);
    expect(tick).toHaveBeenCalledTimes(2);
    gate.resume();
    vi.advanceTimersByTime(100);
    // Ticks missed while paused are not made up.
    expect(tick).toHaveBeenCalledTimes(4);
    globalThis.clearInterval(id);
  });

  it('holds a timeout chain while paused and resumes it where it stopped', () => {
    const { target } = fakeWindow();
    const gate = installAnimationGate(target);
    let steps = 0;
    const step = () => {
      steps++;
      target.setTimeout(step, 100);
    };
    target.setTimeout(step, 100);
    vi.advanceTimersByTime(200);
    expect(steps).toBe(2);
    gate.pause();
    vi.advanceTimersByTime(1000);
    // The step already scheduled from the running chain is held when due.
    expect(steps).toBe(2);
    gate.resume();
    vi.advanceTimersByTime(0);
    expect(steps).toBe(3);
    vi.advanceTimersByTime(100);
    expect(steps).toBe(4);
  });

  it('still runs a one-off timeout while paused, and holds what it schedules', () => {
    const { target } = fakeWindow();
    const gate = installAnimationGate(target);
    gate.pause();
    const debounced = vi.fn();
    const next = vi.fn();
    // A resize debounce, scheduled from an effect or an event.
    target.setTimeout(() => {
      debounced();
      target.setTimeout(next, 10);
    }, 50);
    vi.advanceTimersByTime(100);
    expect(debounced).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    gate.resume();
    vi.advanceTimersByTime(0);
    expect(next).toHaveBeenCalledOnce();
  });

  it('cancels a held timeout, and one rescheduled by a resume before it runs', () => {
    const { target } = fakeWindow();
    const gate = installAnimationGate(target);
    const held = vi.fn();
    const released = vi.fn();
    const ids: number[] = [];
    target.setTimeout(() => {
      ids.push(target.setTimeout(held, 10), target.setTimeout(released, 10));
    }, 0);
    vi.advanceTimersByTime(0);
    gate.pause();
    vi.advanceTimersByTime(50);
    target.clearTimeout(ids[0]);
    gate.resume();
    target.clearTimeout(ids[1]);
    vi.advanceTimersByTime(50);
    expect(held).not.toHaveBeenCalled();
    expect(released).not.toHaveBeenCalled();
  });

  it('draws a frame a timer asks for while paused, but holds a timeout a frame schedules', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    gate.pause();
    const drawn = vi.fn();
    const later = vi.fn();
    frames.target.setTimeout(() => {
      frames.target.requestAnimationFrame(() => {
        drawn();
        frames.target.setTimeout(later, 0);
      });
    }, 0);
    vi.advanceTimersByTime(0);
    frames.tick();
    vi.advanceTimersByTime(100);
    expect(drawn).toHaveBeenCalledOnce();
    expect(later).not.toHaveBeenCalled();
    gate.resume();
    vi.advanceTimersByTime(0);
    expect(later).toHaveBeenCalledOnce();
  });

  it('pauses CSS animations with one rule while paused', () => {
    const gate = installAnimationGate(fakeWindow(document).target);
    const rules = () =>
      [...document.head.querySelectorAll('style')].filter((style) =>
        style.textContent?.includes('animation-play-state: paused')
      );
    gate.pause();
    gate.pause();
    expect(rules()).toHaveLength(1);
    gate.resume();
    expect(rules()).toHaveLength(0);
  });
});

describe('preview animation gate', () => {
  it('passes requests and cancellations straight through while running', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    const callback = vi.fn();
    const id = frames.target.requestAnimationFrame(callback);
    expect(frames.request).toHaveBeenCalledOnce();
    expect(frames.pending.has(id)).toBe(true);
    frames.tick(42);
    expect(callback).toHaveBeenCalledWith(42);

    const cancelled = vi.fn();
    const other = frames.target.requestAnimationFrame(cancelled);
    frames.target.cancelAnimationFrame(other);
    expect(frames.cancel).toHaveBeenLastCalledWith(other);
    frames.tick();
    expect(cancelled).not.toHaveBeenCalled();
    expect(gate.paused).toBe(false);
  });

  it('holds the frames a frame asks for while paused, with ids no other request has', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    const before = frames.target.requestAnimationFrame(vi.fn());
    const held = vi.fn();
    const ids: number[] = [];
    frames.target.requestAnimationFrame(() => {
      ids.push(
        frames.target.requestAnimationFrame(held),
        frames.target.requestAnimationFrame(held)
      );
    });
    gate.pause();
    frames.tick();
    expect(frames.pending.size).toBe(0);
    frames.tick();
    expect(held).not.toHaveBeenCalled();
    expect(new Set([before, ...ids]).size).toBe(3);
    // Later requests do not get a held id either.
    gate.resume();
    const after = frames.target.requestAnimationFrame(vi.fn());
    expect(ids).not.toContain(after);
  });

  it('stops an animation loop on the frame it was drawing and carries it on when resumed', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    let painted = 0;
    const paint = () => {
      painted++;
      frames.target.requestAnimationFrame(paint);
    };
    frames.target.requestAnimationFrame(paint);
    frames.tick();
    gate.pause();
    // Already scheduled: this frame still paints, then the loop is held.
    frames.tick();
    frames.tick();
    frames.tick();
    expect(painted).toBe(2);
    expect(frames.pending.size).toBe(0);
    gate.resume();
    frames.tick();
    frames.tick();
    expect(painted).toBe(4);
  });

  it('still draws a frame asked for from outside one while paused, then holds its loop', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    gate.pause();
    let painted = 0;
    const paint = () => {
      painted++;
      frames.target.requestAnimationFrame(paint);
    };
    // A settings change, a resize or a newly mounted widget asks for one.
    frames.target.requestAnimationFrame(paint);
    frames.tick();
    frames.tick();
    expect(painted).toBe(1);
    expect(frames.pending.size).toBe(0);
    gate.resume();
    frames.tick();
    expect(painted).toBe(2);
  });

  it('cancels a held frame, and a frame scheduled before the pause', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    const early = vi.fn();
    const held = vi.fn();
    const kept = vi.fn();
    let heldId = 0;
    const earlyId = frames.target.requestAnimationFrame(early);
    frames.target.requestAnimationFrame(() => {
      heldId = frames.target.requestAnimationFrame(held);
      frames.target.requestAnimationFrame(kept);
    });
    gate.pause();
    frames.target.cancelAnimationFrame(earlyId);
    frames.tick();
    frames.target.cancelAnimationFrame(heldId);
    gate.resume();
    frames.tick();
    expect(early).not.toHaveBeenCalled();
    expect(held).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
  });

  it('schedules held frames in order on resume, still cancellable by their ids', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    const order: string[] = [];
    let dropped = 0;
    frames.target.requestAnimationFrame(() => {
      frames.target.requestAnimationFrame(() => order.push('first'));
      dropped = frames.target.requestAnimationFrame(() =>
        order.push('dropped')
      );
      frames.target.requestAnimationFrame((time) =>
        order.push(`third@${time}`)
      );
    });
    gate.pause();
    frames.tick();
    expect(frames.pending.size).toBe(0);
    gate.resume();
    expect(frames.pending.size).toBe(3);
    frames.target.cancelAnimationFrame(dropped);
    frames.tick(99);
    expect(order).toEqual(['first', 'third@99']);
    // Once run, an id is nothing to the gate any more.
    frames.target.cancelAnimationFrame(dropped);
    expect(frames.cancel).toHaveBeenLastCalledWith(dropped);
  });

  it('treats a repeated pause or resume as one', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    gate.resume();
    expect(gate.paused).toBe(false);
    gate.pause();
    gate.pause();
    expect(gate.paused).toBe(true);
    const held = vi.fn();
    frames.target.requestAnimationFrame(() =>
      frames.target.requestAnimationFrame(held)
    );
    frames.tick();
    expect(held).not.toHaveBeenCalled();
    gate.resume();
    gate.resume();
    expect(gate.paused).toBe(false);
    frames.tick();
    frames.tick();
    expect(held).toHaveBeenCalledOnce();
  });
});
