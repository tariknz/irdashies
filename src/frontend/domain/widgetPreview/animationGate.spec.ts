import { describe, expect, it, vi } from 'vitest';
import { installAnimationGate } from './animationGate';

/** A window's animation frames, run one frame at a time with `tick`. */
function fakeWindow() {
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
  const target = {
    requestAnimationFrame: request as (
      callback: FrameRequestCallback
    ) => number,
    cancelAnimationFrame: cancel as (id: number) => void,
  };
  const tick = (time = 16) => {
    const due = [...pending.values()];
    pending.clear();
    for (const callback of due) callback(time);
  };
  return { target, pending, request, cancel, tick };
}

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
