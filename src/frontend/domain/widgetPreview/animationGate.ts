/** The part of a window the gate takes over. */
export type AnimationFrames = Pick<
  Window,
  'requestAnimationFrame' | 'cancelAnimationFrame'
>;

export interface AnimationGate {
  /** Holds every animation loop's next frame from now on. */
  pause(): void;
  /** Schedules the held frames, and lets new ones through again. */
  resume(): void;
  readonly paused: boolean;
}

const nothing = () => undefined;

/**
 * Lets a preview frame stop its widgets' animation loops on their last
 * picture.
 *
 * A loop asks for its next frame from inside the current one, so holding
 * the requests made inside a frame stops it after the frame it is drawing.
 * A frame asked for from outside one (a settings change, a resize, a newly
 * mounted widget) still draws once while paused, so the held picture keeps
 * up with what the user changes; a loop it starts is held after that frame.
 * Resuming schedules what was held, so every loop carries on.
 */
export function installAnimationGate(target: AnimationFrames): AnimationGate {
  const request = target.requestAnimationFrame.bind(target);
  const cancel = target.cancelAnimationFrame.bind(target);
  let paused = false;
  /** Set while a frame's callback runs. */
  let inFrame = false;
  /** Asked for while paused, by the id handed out for it. */
  const held = new Map<number, FrameRequestCallback>();
  /** Scheduled by a resume and not run yet: the handed-out id's real one. */
  const released = new Map<number, number>();

  const run = (callback: FrameRequestCallback, time: number) => {
    const outer = inFrame;
    inFrame = true;
    try {
      callback(time);
    } finally {
      inFrame = outer;
    }
  };

  target.requestAnimationFrame = (callback) => {
    if (!paused || !inFrame) return request((time) => run(callback, time));
    // An id the window never hands out again, so it cannot be mistaken for
    // another request's. Cancelled at once, it runs nothing.
    const id = request(nothing);
    cancel(id);
    held.set(id, callback);
    return id;
  };
  target.cancelAnimationFrame = (id) => {
    if (held.delete(id)) return;
    const real = released.get(id);
    if (real === undefined) {
      cancel(id);
      return;
    }
    released.delete(id);
    cancel(real);
  };

  return {
    pause() {
      paused = true;
    },
    resume() {
      if (!paused) return;
      paused = false;
      const callbacks = [...held];
      held.clear();
      for (const [id, callback] of callbacks)
        released.set(
          id,
          request((time) => {
            released.delete(id);
            run(callback, time);
          })
        );
    },
    get paused() {
      return paused;
    },
  };
}
