const MAX_EXTRAPOLATION_S = 0.25;
const MAX_SAMPLE_SPAN_S = 0.25;
const MAX_PLAUSIBLE_SPEED_MS = 150;

export interface PositionHistory {
  previousX: number[];
  previousZ: number[];
  previousT: number[];
  latestX: number[];
  latestZ: number[];
  latestT: number[];
}

export interface AlignedPosition {
  x: number;
  z: number;
}

export const createPositionHistory = (): PositionHistory => ({
  previousX: [],
  previousZ: [],
  previousT: [],
  latestX: [],
  latestZ: [],
  latestT: [],
});

export function alignOpponentPosition(
  history: PositionHistory,
  carIdx: number,
  x: number,
  z: number,
  carTime: number | undefined,
  playerTime: number | undefined,
  out: AlignedPosition
): void {
  out.x = x;
  out.z = z;
  if (
    carTime === undefined ||
    playerTime === undefined ||
    !Number.isFinite(carTime) ||
    !Number.isFinite(playerTime) ||
    !Number.isFinite(x) ||
    !Number.isFinite(z)
  ) {
    return;
  }

  const latestT = history.latestT[carIdx];
  if (latestT === undefined || carTime < latestT) {
    history.previousX[carIdx] = x;
    history.previousZ[carIdx] = z;
    history.previousT[carIdx] = carTime;
    history.latestX[carIdx] = x;
    history.latestZ[carIdx] = z;
    history.latestT[carIdx] = carTime;
    return;
  }
  if (carTime > latestT) {
    history.previousX[carIdx] = history.latestX[carIdx];
    history.previousZ[carIdx] = history.latestZ[carIdx];
    history.previousT[carIdx] = latestT;
    history.latestX[carIdx] = x;
    history.latestZ[carIdx] = z;
    history.latestT[carIdx] = carTime;
  }

  const age = playerTime - carTime;
  const span = carTime - history.previousT[carIdx];
  if (
    age <= 0 ||
    age > MAX_EXTRAPOLATION_S ||
    span <= 0 ||
    span > MAX_SAMPLE_SPAN_S
  ) {
    return;
  }
  const stepX = history.latestX[carIdx] - history.previousX[carIdx];
  const stepZ = history.latestZ[carIdx] - history.previousZ[carIdx];
  if (Math.hypot(stepX, stepZ) / span > MAX_PLAUSIBLE_SPEED_MS) return;
  const factor = age / span;
  out.x = x + stepX * factor;
  out.z = z + stepZ * factor;
}
