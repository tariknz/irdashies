/** The parts of a window the gate takes over. */
export type AnimationClock = Pick<
  Window,
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
  | 'setTimeout'
  | 'clearTimeout'
  | 'setInterval'
> & {
  /** Its CSS and scripted animations are paused too, when given. */
  document?: Pick<Document, 'createElement' | 'head'> & {
    getAnimations?: () => Animation[];
  };
  /** Patched so that animations started while paused start paused. */
  Element?: { prototype: Pick<Element, 'animate'> };
};

export interface AnimationGate {
  /** Holds every animation from now on. */
  pause(): void;
  /** Lets the held animations carry on, and new ones through again. */
  resume(): void;
  readonly paused: boolean;
}

const PAUSE_CSS =
  '*, *::before, *::after { animation-play-state: paused !important; }';

/** Stops the page's CSS animations where they are, with one rule. */
function createCssPause(document: NonNullable<AnimationClock['document']>) {
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
 * Widgets animate four ways, and while paused:
 * - requestAnimationFrame loops (canvases): a frame asked for from inside a
 *   frame is held, since that is how a loop asks for its next one. A frame
 *   asked for from anywhere else (a settings change, a resize, a newly
 *   mounted widget) still draws once, so the held picture keeps up with what
 *   the user changes.
 * - timers (the demo data many widgets generate for themselves, blinking,
 *   rotating pages, cards that expire): an interval's ticks are skipped, and
 *   a timeout that comes due is held until resumed, wherever it was set.
 * - CSS animations are paused where they are.
 * - Web Animations started with `element.animate()` are paused, including
 *   those started while paused.
 *
 * Animation frames go through one dispatcher, so a frame allocates nothing:
 * requests are kept in reused maps and a single stable callback runs them.
 * Resuming schedules what was held, so every loop carries on.
 */
export function installAnimationGate(target: AnimationClock): AnimationGate {
  const request = target.requestAnimationFrame.bind(target);
  const startTimeout = target.setTimeout.bind(target);
  const stopTimeout = target.clearTimeout.bind(target);
  const startInterval = target.setInterval.bind(target);
  const css = target.document && createCssPause(target.document);
  let paused = false;

  // --- Animation frames
  let nextFrameId = 0;
  /** Asked for and waiting for the next frame, in order. */
  let pendingFrames = new Map<number, FrameRequestCallback>();
  /** The frame being run; swapped with `pendingFrames` and reused. */
  let runningFrames = new Map<number, FrameRequestCallback>();
  /** Asked for from inside a frame while paused. */
  const heldFrames = new Map<number, FrameRequestCallback>();
  let frameScheduled = false;
  let inFrame = false;

  const runFrame = (time: number) => {
    frameScheduled = false;
    const due = pendingFrames;
    pendingFrames = runningFrames;
    runningFrames = due;
    inFrame = true;
    try {
      // Live iteration: a callback cancelled by an earlier one is skipped.
      for (const [id, callback] of due) {
        due.delete(id);
        try {
          callback(time);
        } catch (error) {
          // As separate native frames would: the rest still run, and the
          // error is still reported.
          queueMicrotask(() => {
            throw error;
          });
        }
      }
    } finally {
      inFrame = false;
      due.clear();
    }
  };
  const scheduleFrame = () => {
    if (frameScheduled || pendingFrames.size === 0) return;
    frameScheduled = true;
    request(runFrame);
  };

  target.requestAnimationFrame = (callback) => {
    const id = ++nextFrameId;
    if (paused && inFrame) {
      heldFrames.set(id, callback);
      return id;
    }
    pendingFrames.set(id, callback);
    scheduleFrame();
    return id;
  };
  target.cancelAnimationFrame = (id) => {
    if (!pendingFrames.delete(id) && !heldFrames.delete(id))
      runningFrames.delete(id);
  };

  // --- Timers
  /** Timeouts that came due while paused, by their own id. */
  const heldTimeouts = new Map<number, () => void>();
  /** Rescheduled by a resume and not run yet: the original id's new one. */
  const releasedTimeouts = new Map<number, number>();

  target.setTimeout = ((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    if (typeof handler !== 'function')
      return startTimeout(handler, timeout, ...args);
    const fire = () => handler(...args);
    const id: number = startTimeout(() => {
      if (paused) heldTimeouts.set(id, fire);
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
      if (!paused) handler(...args);
    }, timeout);
  }) as AnimationClock['setInterval'];

  // --- Web Animations
  /** Started through `element.animate()`, as opposed to CSS animations. */
  const scripted = new WeakSet<Animation>();
  let pausedAnimations: Animation[] = [];
  const prototype = target.Element?.prototype;
  const animate = prototype?.animate;
  if (prototype && animate) {
    prototype.animate = function (
      this: Element,
      ...args: Parameters<Element['animate']>
    ) {
      const animation = animate.apply(this, args);
      scripted.add(animation);
      if (paused) {
        animation.pause();
        pausedAnimations.push(animation);
      }
      return animation;
    };
  }

  return {
    pause() {
      if (paused) return;
      paused = true;
      css?.pause();
      // Only scripted ones: pausing a CSS animation from script would stop
      // it following its animation-play-state for good.
      for (const animation of target.document?.getAnimations?.() ?? []) {
        if (!scripted.has(animation) || animation.playState !== 'running')
          continue;
        animation.pause();
        pausedAnimations.push(animation);
      }
    },
    resume() {
      if (!paused) return;
      paused = false;
      css?.resume();
      for (const animation of pausedAnimations) {
        if (animation.playState === 'paused') animation.play();
      }
      pausedAnimations = [];
      for (const [id, callback] of heldFrames) pendingFrames.set(id, callback);
      heldFrames.clear();
      scheduleFrame();
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
