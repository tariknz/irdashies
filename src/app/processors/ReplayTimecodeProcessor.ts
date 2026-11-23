import type { Telemetry } from '@irdashies/types';
import type { ReplayTimecodeSnapshot, ProgramState } from '@irdashies/types';

export const LIVE_EDGE_FRAMES = 60;

const FPS_MIN_WINDOW_SECONDS = 2;
const FPS_DEFAULT = 60;
const SEEK_THRESHOLD_SECONDS = 3;

interface ReplayCue {
  frame: number;
  sessionNum: number;
  sessionTime: number;
  playSpeed: number;
  slowMotion: boolean;
  camCarIdx: number;
  camGroupNum: number;
  camCameraNum: number;
  wallMs: number;
  wasLive: boolean;
}

interface PendingLivePosition {
  sessionNum: number;
  sessionTime: number;
  playSpeed: number;
  slowMotion: boolean;
  wallMs: number;
}

const effectiveSpeed = (speed: {
  playSpeed: number;
  slowMotion: boolean;
}): number =>
  speed.slowMotion && speed.playSpeed !== 0
    ? 1 / speed.playSpeed
    : speed.playSpeed;

export class ReplayTimecodeProcessor {
  private cue: ReplayCue | null = null;

  private active = false;
  private sessionNum = 0;
  private sessionTime = 0;
  private frame = 0;
  private frameEnd = 0;
  private playSpeed = 1;
  private slowMotion = false;
  private atLiveEdge = false;
  private pendingLivePosition: PendingLivePosition | null = null;
  private lastFrameWallMs: number | null = null;
  private suppressNextSeek = false;
  private programState: ProgramState = 'onProgram';
  private programSessionNum = 0;
  private programSessionTime = 0;

  private fps = FPS_DEFAULT;
  private fpsWindowFrames = 0;
  private fpsWindowTime = 0;
  private fpsBaseFrame: number | null = null;
  private fpsBaseSessionTime: number | null = null;

  private version = 0;

  constructor(private readonly now: () => number = () => Date.now()) {}

  onFrame(telemetry: Telemetry): boolean {
    const isReplayPlaying =
      (telemetry.IsReplayPlaying?.value?.[0] as boolean | undefined) ?? false;

    if (!isReplayPlaying) {
      if (this.active) {
        this.active = false;
        this.cue = null;
        this.fpsBaseFrame = null;
        this.fpsBaseSessionTime = null;
        this.fpsWindowFrames = 0;
        this.fpsWindowTime = 0;
        this.lastFrameWallMs = null;
        this.suppressNextSeek = false;
        this.pendingLivePosition = null;
        this.version++;
        return true;
      }
      return false;
    }

    const rawFrame =
      (telemetry.ReplayFrameNum?.value?.[0] as number | undefined) ?? 0;
    const rawFrameEnd =
      (telemetry.ReplayFrameNumEnd?.value?.[0] as number | undefined) ?? 0;
    const rawPlaySpeed =
      (telemetry.ReplayPlaySpeed?.value?.[0] as number | undefined) ?? 1;
    const rawSlowMotion =
      (telemetry.ReplayPlaySlowMotion?.value?.[0] as boolean | undefined) ??
      false;
    const rawSessionTimeF =
      (telemetry.ReplaySessionTime?.value?.[0] as number | undefined) ?? 0;
    const rawSessionTime = Math.floor(rawSessionTimeF);
    const rawSessionNum =
      (telemetry.ReplaySessionNum?.value?.[0] as number | undefined) ?? 0;
    const camCarIdx =
      (telemetry.CamCarIdx?.value?.[0] as number | undefined) ?? 0;
    const camGroupNum =
      (telemetry.CamGroupNumber?.value?.[0] as number | undefined) ?? 0;
    const camCameraNum =
      (telemetry.CamCameraNumber?.value?.[0] as number | undefined) ?? 0;

    const wallMs = this.now();
    const elapsedSeconds =
      this.lastFrameWallMs === null
        ? 0
        : Math.max(0, (wallMs - this.lastFrameWallMs) / 1000);
    const expectedAdvance =
      elapsedSeconds *
      effectiveSpeed({
        playSpeed: this.playSpeed,
        slowMotion: this.slowMotion,
      });
    const frameDelta = rawFrame - this.frame;
    const seekThreshold = SEEK_THRESHOLD_SECONDS * this.fps;
    const isSeek =
      this.active &&
      this.lastFrameWallMs !== null &&
      Math.abs(frameDelta - expectedAdvance * this.fps) > seekThreshold &&
      (rawSessionNum !== this.sessionNum ||
        Math.abs(rawSessionTimeF - this.sessionTime - expectedAdvance) >
          SEEK_THRESHOLD_SECONDS);

    const programmaticSeekArrived = isSeek && this.suppressNextSeek;
    if (isSeek) {
      this.fpsBaseFrame = null;
      this.fpsBaseSessionTime = null;
      if (this.suppressNextSeek) {
        this.suppressNextSeek = false;
      } else {
        this.cut(this.lastFrameWallMs ?? wallMs);
      }
    } else if (this.suppressNextSeek && elapsedSeconds > 5) {
      this.suppressNextSeek = false;
    }
    this.lastFrameWallMs = wallMs;
    this.measureFps(rawFrame, rawSessionTimeF);

    const atLiveEdge =
      rawFrameEnd > 0 && rawFrame >= rawFrameEnd - LIVE_EDGE_FRAMES;
    let newProgramSessionNum: number;
    let newProgramSessionTime: number;
    if (this.cue === null) {
      const pending = this.pendingLivePosition;
      if (
        pending &&
        (programmaticSeekArrived ||
          (rawSessionNum === pending.sessionNum &&
            Math.abs(rawSessionTimeF - pending.sessionTime) < 2))
      ) {
        this.pendingLivePosition = null;
        this.suppressNextSeek = false;
      }
      if (this.pendingLivePosition) {
        const anchor = this.pendingLivePosition;
        const elapsed = Math.max(0, (wallMs - anchor.wallMs) / 1000);
        newProgramSessionNum = anchor.sessionNum;
        newProgramSessionTime = Math.floor(
          anchor.sessionTime + elapsed * effectiveSpeed(anchor)
        );
      } else {
        newProgramSessionNum = rawSessionNum;
        newProgramSessionTime = rawSessionTime;
      }
    } else {
      const elapsed = (this.now() - this.cue.wallMs) / 1000;
      newProgramSessionTime = Math.floor(this.cue.sessionTime + elapsed);
      newProgramSessionNum = this.cue.sessionNum;
    }

    const newProgramState: ProgramState =
      this.cue === null ? 'onProgram' : 'cutAway';

    const wasActive = this.active;
    const changed =
      !wasActive ||
      rawSessionTime !== this.sessionTime ||
      rawSessionNum !== this.sessionNum ||
      atLiveEdge !== this.atLiveEdge ||
      newProgramState !== this.programState ||
      newProgramSessionTime !== this.programSessionTime;

    this.active = true;
    this.sessionNum = rawSessionNum;
    this.sessionTime = rawSessionTime;
    this.frame = rawFrame;
    this.frameEnd = rawFrameEnd;
    this.playSpeed = rawPlaySpeed;
    this.slowMotion = rawSlowMotion;
    this.atLiveEdge = atLiveEdge;
    this.programState = newProgramState;
    this.programSessionNum = newProgramSessionNum;
    this.programSessionTime = newProgramSessionTime;

    if (changed) {
      this.version++;
      this.camCarIdx = camCarIdx;
      this.camGroupNum = camGroupNum;
      this.camCameraNum = camCameraNum;
      return true;
    }

    this.camCarIdx = camCarIdx;
    this.camGroupNum = camGroupNum;
    this.camCameraNum = camCameraNum;
    return false;
  }

  private camCarIdx = 0;
  private camGroupNum = 0;
  private camCameraNum = 0;

  private measureFps(frame: number, sessionTimeF: number): void {
    if (
      this.fpsBaseFrame === null ||
      this.fpsBaseSessionTime === null ||
      frame < this.fpsBaseFrame
    ) {
      this.fpsBaseFrame = frame;
      this.fpsBaseSessionTime = sessionTimeF;
      this.fpsWindowFrames = 0;
      this.fpsWindowTime = 0;
      return;
    }

    const dFrames = frame - this.fpsBaseFrame;
    const dTime = sessionTimeF - this.fpsBaseSessionTime;

    if (dTime < FPS_MIN_WINDOW_SECONDS || dFrames === 0) return;

    const measured = dFrames / dTime;
    if (measured > 0 && Number.isFinite(measured)) {
      this.fps = measured;
    }

    this.fpsBaseFrame = frame;
    this.fpsBaseSessionTime = sessionTimeF;
  }

  cut(wallMs = this.now()): void {
    if (this.cue !== null) return;
    if (!this.active) return;
    this.cue = {
      frame: this.frame,
      sessionNum: this.sessionNum,
      sessionTime: this.sessionTime,
      playSpeed: this.playSpeed,
      slowMotion: this.slowMotion,
      camCarIdx: this.camCarIdx,
      camGroupNum: this.camGroupNum,
      camCameraNum: this.camCameraNum,
      wallMs,
      wasLive: this.atLiveEdge,
    };
  }

  programTarget(): {
    frame: number;
    sessionNum: number;
    sessionTime: number;
  } | null {
    if (this.cue === null) return null;
    const elapsed = (this.now() - this.cue.wallMs) / 1000;
    const targetFrame = Math.min(
      this.cue.frame + Math.round(elapsed * this.fps),
      this.frameEnd
    );
    return {
      frame: targetFrame,
      sessionNum: this.cue.sessionNum,
      sessionTime: Math.floor(this.cue.sessionTime + elapsed),
    };
  }

  cueFrame(): number | null {
    return this.cue?.frame ?? null;
  }

  getCue(): Readonly<ReplayCue> | null {
    return this.cue;
  }

  returned(target?: {
    sessionNum: number;
    sessionTime: number;
    playSpeed: number;
    slowMotion: boolean;
  }): void {
    this.cue = null;
    this.programState = 'onProgram';
    this.pendingLivePosition = target
      ? { ...target, wallMs: this.now() }
      : null;
    this.programSessionNum = target?.sessionNum ?? this.sessionNum;
    this.programSessionTime = target?.sessionTime ?? this.sessionTime;
    this.version++;
  }

  expectProgrammaticSeek(): void {
    this.suppressNextSeek = true;
  }

  onLifecycle(event: {
    type: 'enter' | 'disconnect' | 'sessionNumChange';
  }): void {
    if (event.type === 'enter' || event.type === 'disconnect') {
      this.cue = null;
      this.lastFrameWallMs = null;
      this.suppressNextSeek = false;
      this.pendingLivePosition = null;
      if (event.type === 'disconnect') {
        this.active = false;
      }
      this.version++;
    }
  }

  onSession(): void {
    // Session is consumed by the runtime for car-number lookup.
  }

  snapshot(): ReplayTimecodeSnapshot {
    if (!this.active) {
      return {
        active: false,
        sessionNum: 0,
        sessionTime: 0,
        frame: 0,
        frameEnd: 0,
        playSpeed: 1,
        slowMotion: false,
        atLiveEdge: false,
        program: {
          state: 'onProgram',
          sessionNum: 0,
          sessionTime: 0,
          cutawaySessionTime: null,
          offsetSeconds: 0,
          wasLive: false,
        },
        version: this.version,
      };
    }

    const offsetSeconds = this.sessionTime - this.programSessionTime;

    return {
      active: true,
      sessionNum: this.sessionNum,
      sessionTime: this.sessionTime,
      frame: this.frame,
      frameEnd: this.frameEnd,
      playSpeed: this.playSpeed,
      slowMotion: this.slowMotion,
      atLiveEdge: this.atLiveEdge,
      program: {
        state: this.programState,
        sessionNum: this.programSessionNum,
        sessionTime: this.programSessionTime,
        cutawaySessionTime: this.cue?.sessionTime ?? null,
        offsetSeconds,
        wasLive: this.cue?.wasLive ?? false,
      },
      version: this.version,
    };
  }

  fps_(): number {
    return this.fps;
  }
}
