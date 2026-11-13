import { area, curveBasis, line, scaleLinear } from 'd3';
import { getColor } from '@irdashies/utils/colors';

export interface InputTraceInput {
  clutch?: number;
  brake?: number;
  brakeAbsActive?: boolean;
  throttle?: number;
  steer?: number;
}

export interface InputTraceSettings {
  includeClutch: boolean;
  includeThrottle: boolean;
  includeBrake: boolean;
  includeAbs: boolean;
  absStyle: 'overlay' | 'bar';
  includeSteer: boolean;
  strokeWidth: number;
  maxSamples: number;
}

const TRACE_WIDTH = 400;
const TRACE_HEIGHT = 100;
// Match the settings UI limit and bound allocations from external configs.
const MAX_TRACE_SAMPLES = 1000;
const GRID_TICKS = [0, 0.25, 0.5, 0.75, 1];
const GRID_DASH = [2, 2];
const SOLID_DASH: number[] = [];
const DEFAULT_SETTINGS: Partial<InputTraceSettings> = {};
const BRAKE_COLOR = getColor('red');
const ABS_COLOR = getColor('yellow', 500);
const THROTTLE_COLOR = getColor('green');
const CLUTCH_COLOR = getColor('blue');
const STEER_COLOR = getColor('slate', 300);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Owns a bounded sample ring and persistent D3 generators with a Canvas sink. */
export class InputTraceDrawing {
  private readonly settings: InputTraceSettings = {
    includeClutch: true,
    includeThrottle: true,
    includeBrake: true,
    includeAbs: true,
    absStyle: 'overlay',
    includeSteer: true,
    strokeWidth: 3,
    maxSamples: 400,
  };
  private brake: number[] = [];
  private abs: boolean[] = [];
  private throttle: number[] = [];
  private clutch: number[] = [];
  private steer: number[] = [];
  private indices: number[] = [];
  private writeIndex = 0;
  private values: number[] = [];
  private readonly x = scaleLinear().range([0, TRACE_WIDTH]);
  private readonly y = scaleLinear()
    .domain([-0.05, 1.05])
    .range([TRACE_HEIGHT, 0]);
  private readonly sampleIndex = (index: number) =>
    (this.writeIndex + index) % this.indices.length;
  private readonly brakeY = (index: number) =>
    this.y(clamp(this.brake[this.sampleIndex(index)]));
  private readonly absActive = (index: number) =>
    this.abs[this.sampleIndex(index)];
  private readonly standardLine;
  private readonly steeringLine;
  private readonly absLine;
  private readonly absArea;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.standardLine = line<number>()
      .x((index) => this.x(index))
      .y((index) => this.y(clamp(this.values[this.sampleIndex(index)])))
      .curve(curveBasis)
      .context(ctx);
    this.steeringLine = line<number>()
      .x((index) => this.x(index))
      .y(
        (index) =>
          TRACE_HEIGHT / 2 -
          (this.values[this.sampleIndex(index)] - 0.5) * TRACE_HEIGHT
      )
      .curve(curveBasis)
      .context(ctx);
    this.absLine = line<number>()
      .x((index) => this.x(index))
      .y(this.brakeY)
      .defined(this.absActive)
      .curve(curveBasis)
      .context(ctx);
    this.absArea = area<number>()
      .x((index) => this.x(index))
      .y0(this.y(0))
      .y1(this.brakeY)
      .defined(this.absActive)
      .curve(curveBasis)
      .context(ctx);
    this.configure();
  }

  /** Apply defaults and reset every channel together when history capacity changes. */
  configure(settings: Partial<InputTraceSettings> = DEFAULT_SETTINGS): void {
    const current = this.settings;
    current.includeClutch = settings.includeClutch ?? true;
    current.includeThrottle = settings.includeThrottle ?? true;
    current.includeBrake = settings.includeBrake ?? true;
    current.includeAbs = settings.includeAbs ?? true;
    current.includeSteer = settings.includeSteer ?? true;
    current.absStyle = settings.absStyle ?? 'overlay';
    current.strokeWidth = settings.strokeWidth ?? 3;
    const requested = settings.maxSamples ?? 400;
    current.maxSamples = Number.isFinite(requested)
      ? Math.max(2, Math.min(MAX_TRACE_SAMPLES, Math.floor(requested)))
      : 400;
    if (this.indices.length === current.maxSamples) return;

    // Capacity is fixed between configuration changes; all channels reset
    // together so changing capacity never reuses an old time axis.
    const count = current.maxSamples;
    this.brake = Array<number>(count).fill(0);
    this.abs = Array<boolean>(count).fill(false);
    this.throttle = Array<number>(count).fill(0);
    this.clutch = Array<number>(count).fill(0);
    this.steer = Array<number>(count).fill(0.5);
    this.indices = Array.from({ length: count }, (_, index) => index);
    this.x.domain([0, count - 1]);
    this.writeIndex = 0;
    this.values = this.brake;
  }

  /** Record one tick for each enabled channel and advance the ring buffer. */
  sample(input: InputTraceInput): void {
    const { settings, writeIndex: index } = this;
    if (settings.includeBrake) {
      this.brake[index] = input.brake ?? 0;
      if (settings.includeAbs) this.abs[index] = input.brakeAbsActive ?? false;
    }
    if (settings.includeThrottle) this.throttle[index] = input.throttle ?? 0;
    if (settings.includeClutch) this.clutch[index] = input.clutch ?? 0;
    if (settings.includeSteer) {
      this.steer[index] = clamp((input.steer ?? 0) / (2 * Math.PI) + 0.5);
    }
    this.writeIndex = (index + 1) % this.indices.length;
  }

  /** Draw one chronological curve using the shared generators and current width. */
  private stroke(values: number[], color: string, centered = false): void {
    this.values = values;
    this.ctx.beginPath();
    (centered ? this.steeringLine : this.standardLine)(this.indices);
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
  }

  /** Draw the reference grid before the input curves. */
  private drawGrid(): void {
    const { ctx } = this;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#666';
    ctx.setLineDash(GRID_DASH);
    ctx.beginPath();
    for (const tick of GRID_TICKS) {
      const y = this.y(tick);
      ctx.moveTo(0, y);
      ctx.lineTo(TRACE_WIDTH, y);
    }
    ctx.stroke();
    ctx.setLineDash(SOLID_DASH);
  }

  /** Painting never advances history: resizes and scale changes only repaint. */
  paint = (): void => {
    const { ctx, settings } = this;
    if (ctx.canvas.width <= 0 || ctx.canvas.height <= 0) return;
    ctx.setTransform(
      ctx.canvas.width / TRACE_WIDTH,
      0,
      0,
      ctx.canvas.height / TRACE_HEIGHT,
      0,
      0
    );
    ctx.clearRect(0, 0, TRACE_WIDTH, TRACE_HEIGHT);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    this.drawGrid();

    if (settings.includeSteer) this.stroke(this.steer, STEER_COLOR, true);
    const visibleStroke = settings.strokeWidth > 0;
    if (visibleStroke) ctx.lineWidth = settings.strokeWidth;
    if (visibleStroke && settings.includeClutch)
      this.stroke(this.clutch, CLUTCH_COLOR);
    if (visibleStroke && settings.includeThrottle)
      this.stroke(this.throttle, THROTTLE_COLOR);
    if (settings.includeBrake) this.drawBrake(visibleStroke);
  };

  /** Keep the ABS fill below the brake curve and its highlight above it. */
  private drawBrake(visibleStroke: boolean): void {
    const { ctx, settings } = this;
    if (settings.includeAbs && settings.absStyle === 'bar') {
      ctx.beginPath();
      this.absArea(this.indices);
      ctx.fillStyle = ABS_COLOR;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (visibleStroke) this.stroke(this.brake, BRAKE_COLOR);
    if (visibleStroke && settings.includeAbs) {
      ctx.beginPath();
      this.absLine(this.indices);
      ctx.strokeStyle = ABS_COLOR;
      ctx.lineWidth =
        settings.absStyle === 'bar'
          ? settings.strokeWidth
          : Math.round(settings.strokeWidth * 1.67);
      ctx.stroke();
    }
  }
}
