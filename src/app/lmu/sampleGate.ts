const MAX_CARS = 128;
const COUNT_INTERVAL_S = 0.1;
const MAX_GAP_S = 1;
const JUMP_SLACK_M = 30;
const JUMP_SPEED_SHARE = 0.5;
const JUMP_HOLD_S = 2;
const MAX_PLAUSIBLE_SPEED_MS = 120;

export interface SampleGateInput {
  time: number;
  lapDistM: number;
  live: boolean;
  pcts: readonly unknown[];
  scoringPcts?: ArrayLike<number>;
  speeds?: ArrayLike<number>;
}

export interface SampleGateCounts {
  beforeLine: number;
  jumping: number;
  stale: number;
}

const wrap01 = (value: number): number => ((value % 1) + 1) % 1;

export class LmuSampleGate {
  readonly valid = new Uint8Array(MAX_CARS);
  private readonly lastPct = new Float64Array(MAX_CARS).fill(Number.NaN);
  private readonly heldUntil = new Float64Array(MAX_CARS).fill(
    Number.NEGATIVE_INFINITY
  );
  private lastTime = Number.NaN;
  private lastCountTime = Number.NEGATIVE_INFINITY;
  private readonly tally: SampleGateCounts = {
    beforeLine: 0,
    jumping: 0,
    stale: 0,
  };

  get counts(): Readonly<SampleGateCounts> {
    return this.tally;
  }

  reset(): void {
    this.valid.fill(0);
    this.lastPct.fill(Number.NaN);
    this.heldUntil.fill(Number.NEGATIVE_INFINITY);
    this.lastTime = Number.NaN;
    this.lastCountTime = Number.NEGATIVE_INFINITY;
    this.tally.beforeLine = 0;
    this.tally.jumping = 0;
    this.tally.stale = 0;
  }

  describe(): string {
    const { beforeLine, jumping, stale } = this.tally;
    if (beforeLine + jumping + stale === 0) return '';
    return `skipped ${beforeLine} car samples before the start line, ${jumping} jumping, ${stale} while the data was stale`;
  }

  update(input: SampleGateInput): void {
    const { time } = input;
    if (time < this.lastCountTime)
      this.lastCountTime = Number.NEGATIVE_INFINITY;
    const counting = time - this.lastCountTime >= COUNT_INTERVAL_S;
    if (counting) this.lastCountTime = time;
    const cars = Math.min(input.pcts.length, MAX_CARS);
    this.valid.fill(0);

    if (!input.live) {
      if (counting) this.tally.stale += 1;
      this.lastPct.fill(Number.NaN);
      this.lastTime = Number.NaN;
      return;
    }

    const dt = time - this.lastTime;
    const continuous = dt > 0 && dt <= MAX_GAP_S;
    const lapDistM = input.lapDistM;
    for (let carIdx = 0; carIdx < cars; carIdx += 1) {
      const value = input.pcts[carIdx];
      const pct = typeof value === 'number' ? value : Number.NaN;
      const scoring = input.scoringPcts?.[carIdx];
      const previous = this.lastPct[carIdx];
      this.lastPct[carIdx] = pct;
      if (!Number.isFinite(pct)) continue;

      if (!(pct > 0) || (scoring !== undefined && !(scoring > 0))) {
        if (counting) this.tally.beforeLine += 1;
        continue;
      }
      if (!continuous || !Number.isFinite(previous)) continue;

      let travelled = wrap01(pct - previous) * lapDistM;
      if (travelled > lapDistM / 2) travelled -= lapDistM;
      const speed = input.speeds?.[carIdx];
      const jumped =
        speed !== undefined && Number.isFinite(speed)
          ? Math.abs(travelled - speed * dt) >
            JUMP_SLACK_M + JUMP_SPEED_SHARE * Math.abs(speed * dt)
          : Math.abs(travelled) > JUMP_SLACK_M + MAX_PLAUSIBLE_SPEED_MS * dt;
      if (jumped) {
        this.heldUntil[carIdx] = time + JUMP_HOLD_S;
      }
      if (time < this.heldUntil[carIdx]) {
        if (counting) this.tally.jumping += 1;
        continue;
      }
      this.valid[carIdx] = 1;
    }
    this.lastPct.fill(Number.NaN, cars);
    this.lastTime = time;
  }
}
