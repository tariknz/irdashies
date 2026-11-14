/** The parts of a window the gate takes over. */
export type AnimationClock = Pick<
  Window,
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
  | 'setTimeout'
  | 'clearTimeout'
  | 'setInterval'
> & {
  /** Its CSS animations are paused too, when given. */
  document?: Document;
};

export interface AnimationGate {
  /** Holds every animation loop from now on. */
  pause(): void;
  /** Lets the held loops carry on, and new ones through again. */
  resume(): void;
  readonly paused: boolean;
}

/** The kind of callback running at the moment, if any. */
type Context = 'frame' | 'timer' | null;

const nothing = () => undefined;

const PAUSE_CSS =
  '*, *::before, *::after { animation-play-state: paused !important; }';

/** Stops the page's CSS animations where they are, with one rule. */
function createCssPause(document: Document) {
  let style: HTMLStyleElement | undefined;
  return {
    pause() {
      if (style) return;
      style = document.createElement('style');
      style.textContent = PAUSE_CSS;
      document.head.append(style);
    },
    resume() {
      style?.remove();
      style = undefined;
    },
  };
}

/**
 * Lets a preview frame stop its widgets' animations on their last picture.
 *
 * Widgets animate three ways: requestAnimationFrame loops (canvases), timers
 * (the demo data many widgets generate for themselves, blinking, rotating
 * pages) and CSS animations. While paused:
 * - a frame asked for from inside a frame is held, since that is how a loop
 *   asks for its next one. A frame asked for from anywhere else (a settings
 *   change, a resize, a newly mounted widget, a timer) still draws once.
 * - an interval's ticks are skipped: an interval is a loop.
 * - a timeout scheduled from inside a frame or timer callback is held, as a
 *   step of a loop. One scheduled from anywhere else, such as a resize
 *   debounce, still runs, so the held picture keeps up with what the user
 *   changes; what it schedules in turn is held.
 * - CSS animations are paused where they are.
 *
 * Each chain stops after at most one step, whatever it alternates between.
 * Resuming schedules what was held, so every loop carries on.
 */
export function installAnimationGate(target: AnimationClock): AnimationGate {
  const request = target.requestAnimationFrame.bind(target);
  const cancel = target.cancelAnimationFrame.bind(target);
  const startTimeout = target.setTimeout.bind(target);
  const stopTimeout = target.clearTimeout.bind(target);
  const startInterval = target.setInterval.bind(target);
  const css = target.document && createCssPause(target.document);
  let paused = false;
  let context: Context = null;
  /** Frames asked for while paused, by the id handed out for them. */
  const heldFrames = new Map<number, FrameRequestCallback>();
  /** Scheduled by a resume and not run yet: the handed-out id's real one. */
  const releasedFrames = new Map<number, number>();
  /** Timeouts that came due while paused, by their own id. */
  const heldTimeouts = new Map<number, () => void>();
  /** Rescheduled by a resume and not run yet: the original id's new one. */
  const releasedTimeouts = new Map<number, number>();

  const within = (kind: 'frame' | 'timer', callback: () => void) => {
    const outer = context;
    context = kind;
    try {
      callback();
    } finally {
      context = outer;
    }
  };

  target.requestAnimationFrame = (callback) => {
    const frame = (time: number) => within('frame', () => callback(time));
    if (!paused || context !== 'frame') return request(frame);
    // An id the window never hands out again, so it cannot be mistaken for
    // another request's. Cancelled at once, it runs nothing.
    const id = request(nothing);
    cancel(id);
    heldFrames.set(id, callback);
    return id;
  };
  target.cancelAnimationFrame = (id) => {
    if (heldFrames.delete(id)) return;
    const real = releasedFrames.get(id);
    if (real === undefined) {
      cancel(id);
      return;
    }
    releasedFrames.delete(id);
    cancel(real);
  };

  target.setTimeout = ((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    if (typeof handler !== 'function')
      return startTimeout(handler, timeout, ...args);
    const step = context !== null;
    const fire = () => within('timer', () => handler(...args));
    const id: number = startTimeout(() => {
      if (paused && step) heldTimeouts.set(id, fire);
      else fire();
    }, timeout);
    return id;
  }) as AnimationClock['setTimeout'];
  target.clearTimeout = (id) => {
    if (id === undefined) return;
    if (heldTimeouts.delete(id)) return;
    const real = releasedTimeouts.get(id);
    if (real === undefined) {
      stopTimeout(id);
      return;
    }
    releasedTimeouts.delete(id);
    stopTimeout(real);
  };

  target.setInterval = ((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    if (typeof handler !== 'function')
      return startInterval(handler, timeout, ...args);
    return startInterval(() => {
      if (!paused) within('timer', () => handler(...args));
    }, timeout);
  }) as AnimationClock['setInterval'];

  return {
    pause() {
      paused = true;
      css?.pause();
    },
    resume() {
      if (!paused) return;
      paused = false;
      css?.resume();
      const frames = [...heldFrames];
      heldFrames.clear();
      for (const [id, callback] of frames)
        releasedFrames.set(
          id,
          request((time) => {
            releasedFrames.delete(id);
            within('frame', () => callback(time));
          })
        );
      const timeouts = [...heldTimeouts];
      heldTimeouts.clear();
      for (const [id, fire] of timeouts)
        releasedTimeouts.set(
          id,
          startTimeout(() => {
            releasedTimeouts.delete(id);
            fire();
          }, 0)
        );
    },
    get paused() {
      return paused;
    },
  };
}
