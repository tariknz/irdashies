import type { Telemetry } from '@irdashies/types';
import type { ReplayTimecodeSnapshot, ProgramState } from '@irdashies/types';

export const LIVE_EDGE_FRAMES = 60;

const FPS_MIN_WINDOW_SECONDS = 2;
const FPS_DEFAULT = 60;

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

const effectiveSpeed = (cue: ReplayCue): number =>
  cue.slowMotion && cue.playSpeed !== 0 ? 1 / cue.playSpeed : cue.playSpeed;

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

    this.measureFps(rawFrame, rawSessionTimeF);

    const atLiveEdge =
      rawFrameEnd > 0 && rawFrame >= rawFrameEnd - LIVE_EDGE_FRAMES;

    let newProgramSessionNum: number;
    let newProgramSessionTime: number;
    if (this.cue === null) {
      newProgramSessionNum = rawSessionNum;
      newProgramSessionTime = rawSessionTime;
    } else {
      const elapsed = (this.now() - this.cue.wallMs) / 1000;
      const speed = this.cue.playSpeed === 0 ? 0 : effectiveSpeed(this.cue);
      const advance = elapsed * speed;
      newProgramSessionTime = Math.floor(this.cue.sessionTime + advance);
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

  cut(): void {
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
      wallMs: this.now(),
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
    const speed = this.cue.playSpeed === 0 ? 0 : effectiveSpeed(this.cue);
    const advance = elapsed * speed;
    const targetFrame = Math.min(
      this.cue.frame + Math.round(advance * this.fps),
      this.frameEnd
    );
    return {
      frame: targetFrame,
      sessionNum: this.cue.sessionNum,
      sessionTime: Math.floor(this.cue.sessionTime + advance),
    };
  }

  cueFrame(): number | null {
    return this.cue?.frame ?? null;
  }

  getCue(): Readonly<ReplayCue> | null {
    return this.cue;
  }

  returned(): void {
    this.cue = null;
    this.programState = 'onProgram';
    this.version++;
  }

  onLifecycle(event: {
    type: 'enter' | 'disconnect' | 'sessionNumChange';
  }): void {
    if (event.type === 'enter' || event.type === 'disconnect') {
      this.cue = null;
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
