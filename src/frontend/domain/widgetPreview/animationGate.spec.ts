import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installAnimationGate, type AnimationClock } from './animationGate';

/**
 * A window's animation frames, run one frame at a time with `tick`, and its
 * timers, which are Vitest's fake ones.
 */
function fakeWindow(extra: Partial<AnimationClock> = {}) {
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
    ...extra,
  };
  const tick = (time = 16) => {
    const due = [...pending.values()];
    pending.clear();
    for (const callback of due) callback(time);
  };
  return { target, pending, request, cancel, tick };
}

/** A Web Animation as far as the gate looks at one. */
function fakeAnimation() {
  const animation = {
    playState: 'running' as AnimationPlayState,
    pause: vi.fn(() => {
      animation.playState = 'paused';
    }),
    play: vi.fn(() => {
      animation.playState = 'running';
    }),
  };
  return animation;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('preview animation gate: timers', () => {
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
    expect(steps).toBe(2);
    gate.resume();
    vi.advanceTimersByTime(0);
    expect(steps).toBe(3);
    vi.advanceTimersByTime(100);
    expect(steps).toBe(4);
  });

  it('holds a timeout set from an effect too, such as a card that expires', () => {
    const { target } = fakeWindow();
    const gate = installAnimationGate(target);
    const expire = vi.fn();
    // Set from outside any gated callback, as a React effect would.
    target.setTimeout(expire, 50);
    gate.pause();
    vi.advanceTimersByTime(1000);
    expect(expire).not.toHaveBeenCalled();
    gate.resume();
    vi.advanceTimersByTime(0);
    expect(expire).toHaveBeenCalledOnce();
  });

  it('cancels a held timeout, and one rescheduled by a resume before it runs', () => {
    const { target } = fakeWindow();
    const gate = installAnimationGate(target);
    const held = vi.fn();
    const released = vi.fn();
    const heldId = target.setTimeout(held, 10);
    const releasedId = target.setTimeout(released, 10);
    gate.pause();
    vi.advanceTimersByTime(50);
    target.clearTimeout(heldId);
    gate.resume();
    target.clearTimeout(releasedId);
    vi.advanceTimersByTime(50);
    expect(held).not.toHaveBeenCalled();
    expect(released).not.toHaveBeenCalled();
  });
});

describe('preview animation gate: CSS and Web Animations', () => {
  it('pauses CSS animations with one rule while paused', () => {
    const gate = installAnimationGate(fakeWindow({ document }).target);
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

  it('pauses Web Animations, also those started while paused, and leaves CSS ones to the rule', () => {
    const created: ReturnType<typeof fakeAnimation>[] = [];
    const prototype = {
      animate: vi.fn(() => {
        const animation = fakeAnimation();
        created.push(animation);
        return animation as unknown as Animation;
      }),
    } as unknown as Pick<Element, 'animate'>;
    const cssAnimation = fakeAnimation();
    const fakeDocument = {
      createElement: document.createElement.bind(document),
      head: document.head,
      getAnimations: () => [...created, cssAnimation] as unknown as Animation[],
    } as AnimationClock['document'];
    const gate = installAnimationGate(
      fakeWindow({ document: fakeDocument, Element: { prototype } }).target
    );
    const element = document.createElement('div');
    // The name and tag of a Standings row, alternating.
    prototype.animate.call(element, [], { iterations: Infinity });
    prototype.animate.call(element, [], {});
    const finished = created[1];
    finished.playState = 'finished';

    gate.pause();
    expect(created[0].playState).toBe('paused');
    expect(finished.pause).not.toHaveBeenCalled();
    expect(cssAnimation.pause).not.toHaveBeenCalled();
    prototype.animate.call(element, [], {});
    expect(created[2].playState).toBe('paused');

    gate.resume();
    expect(created[0].playState).toBe('running');
    expect(created[2].playState).toBe('running');
    expect(finished.play).not.toHaveBeenCalled();
    expect(cssAnimation.play).not.toHaveBeenCalled();
  });
});

describe('preview animation gate: animation frames', () => {
  it('runs a frame through one native callback, with cancellation, while running', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    const first = vi.fn();
    const cancelled = vi.fn();
    const second = vi.fn();
    frames.target.requestAnimationFrame(first);
    const id = frames.target.requestAnimationFrame(cancelled);
    frames.target.requestAnimationFrame(second);
    expect(frames.request).toHaveBeenCalledOnce();
    frames.target.cancelAnimationFrame(id);
    frames.tick(42);
    expect(first).toHaveBeenCalledWith(42);
    expect(second).toHaveBeenCalledWith(42);
    expect(cancelled).not.toHaveBeenCalled();
    expect(gate.paused).toBe(false);
  });

  it('hands every request its own id, before, during and after a pause', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    const ids = [frames.target.requestAnimationFrame(vi.fn())];
    frames.target.requestAnimationFrame(() => {
      ids.push(
        frames.target.requestAnimationFrame(vi.fn()),
        frames.target.requestAnimationFrame(vi.fn())
      );
    });
    gate.pause();
    frames.tick();
    gate.resume();
    ids.push(frames.target.requestAnimationFrame(vi.fn()));
    expect(new Set(ids).size).toBe(4);
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

  it('cancels a held frame, and one later in the frame being run', () => {
    const frames = fakeWindow();
    const gate = installAnimationGate(frames.target);
    const held = vi.fn();
    const kept = vi.fn();
    const later = vi.fn();
    let heldId = 0;
    let laterId = 0;
    frames.target.requestAnimationFrame(() => {
      heldId = frames.target.requestAnimationFrame(held);
      frames.target.requestAnimationFrame(kept);
      frames.target.cancelAnimationFrame(laterId);
    });
    laterId = frames.target.requestAnimationFrame(later);
    gate.pause();
    frames.tick();
    expect(later).not.toHaveBeenCalled();
    frames.target.cancelAnimationFrame(heldId);
    gate.resume();
    frames.tick();
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
    expect(frames.pending.size).toBe(1);
    frames.target.cancelAnimationFrame(dropped);
    frames.tick(99);
    expect(order).toEqual(['first', 'third@99']);
  });

  it('runs the rest of a frame when one callback throws, and still reports it', () => {
    const report = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(() => undefined);
    const frames = fakeWindow();
    installAnimationGate(frames.target);
    const after = vi.fn();
    frames.target.requestAnimationFrame(() => {
      throw new Error('broken widget');
    });
    frames.target.requestAnimationFrame(after);
    frames.tick();
    expect(after).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
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
