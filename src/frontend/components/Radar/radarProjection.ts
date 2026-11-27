import {
  pointAtProgress,
  tangentAtProgress,
  type TrackGeometry,
  type TrackPathPoint,
} from '@irdashies/domain/track';

export interface ScreenPose {
  x: number;
  y: number;
  /** Screen angle of the direction of travel, radians, 0 = pointing right. */
  angle: number;
}

/**
 * Maps track positions around the focus car onto the radar disc: the focus
 * car at the centre, its direction of travel pointing up.
 *
 * With a track drawing, positions follow the drawn centreline, so a car in a
 * corner sits on the curve ahead rather than straight above. Without one
 * (no drawing for the track, or a broken one) the road is drawn straight.
 */
export class RadarProjector {
  private geometry: TrackGeometry | null = null;
  private trackLength = 0;
  private playerPct = 0;
  private centreX = 0;
  private centreY = 0;
  private pixelsPerMetre = 1;
  private readonly origin: TrackPathPoint = { x: 0, y: 0 };
  private readonly forward: TrackPathPoint = { x: 0, y: -1 };
  private readonly point: TrackPathPoint = { x: 0, y: 0 };
  private readonly tangent: TrackPathPoint = { x: 0, y: -1 };
  private hasMapFrame = false;
  private frameOriginX = 0;
  private frameOriginY = 0;
  private frame00 = 0;
  private frame01 = 0;
  private frame10 = 0;
  private frame11 = 0;

  setup(
    geometry: TrackGeometry | null,
    trackLength: number,
    playerPct: number,
    centreX: number,
    centreY: number,
    pixelsPerMetre: number,
    mapFrame: readonly number[] | null = null
  ): void {
    this.geometry = trackLength > 0 ? geometry : null;
    this.trackLength = trackLength;
    this.playerPct = playerPct;
    this.centreX = centreX;
    this.centreY = centreY;
    this.pixelsPerMetre = pixelsPerMetre;
    this.hasMapFrame =
      this.geometry !== null &&
      mapFrame !== null &&
      mapFrame.length === 6 &&
      mapFrame.every(Number.isFinite);
    if (this.hasMapFrame && mapFrame) {
      this.frameOriginX = mapFrame[0];
      this.frameOriginY = mapFrame[1];
      this.frame00 = mapFrame[2];
      this.frame01 = mapFrame[3];
      this.frame10 = mapFrame[4];
      this.frame11 = mapFrame[5];
    }
    if (this.geometry) {
      pointAtProgress(this.geometry, playerPct, this.origin);
      tangentAtProgress(this.geometry, playerPct, this.forward);
    }
  }

  get hasTrack(): boolean {
    return this.geometry !== null;
  }

  projectOffset(
    ahead: number,
    lateral: number,
    headingRad: number,
    output: ScreenPose
  ): ScreenPose {
    output.x = this.centreX - lateral * this.pixelsPerMetre;
    output.y = this.centreY - ahead * this.pixelsPerMetre;
    output.angle = -Math.PI / 2 - headingRad;
    return output;
  }

  /**
   * @param dist metres along the track from the focus car, positive ahead
   * @param lateral metres from the centreline, positive to the left
   */
  project(dist: number, lateral: number, output: ScreenPose): ScreenPose {
    const geometry = this.geometry;
    if (!geometry) {
      output.x = this.centreX - lateral * this.pixelsPerMetre;
      output.y = this.centreY - dist * this.pixelsPerMetre;
      output.angle = -Math.PI / 2;
      return output;
    }

    const pct = this.playerPct + dist / this.trackLength;
    const units = geometry.unitsPerMeter;
    pointAtProgress(geometry, pct, this.point);
    tangentAtProgress(geometry, pct, this.tangent);
    if (this.hasMapFrame) {
      return this.projectThroughMapFrame(lateral, output);
    }
    // Left of travel in y-down drawing coordinates.
    const worldX = this.point.x + this.tangent.y * lateral * units;
    const worldY = this.point.y - this.tangent.x * lateral * units;

    const { forward } = this;
    const relX = (worldX - this.origin.x) / units;
    const relY = (worldY - this.origin.y) / units;
    const ahead = relX * forward.x + relY * forward.y;
    const left = relX * forward.y - relY * forward.x;
    output.x = this.centreX - left * this.pixelsPerMetre;
    output.y = this.centreY - ahead * this.pixelsPerMetre;

    const headingAhead =
      this.tangent.x * forward.x + this.tangent.y * forward.y;
    const headingLeft = this.tangent.x * forward.y - this.tangent.y * forward.x;
    output.angle = Math.atan2(-headingAhead, -headingLeft);
    return output;
  }

  private projectThroughMapFrame(
    lateral: number,
    output: ScreenPose
  ): ScreenPose {
    const relX = this.point.x - this.frameOriginX;
    const relY = this.point.y - this.frameOriginY;
    let right = this.frame00 * relX + this.frame01 * relY;
    let ahead = this.frame10 * relX + this.frame11 * relY;
    const travelRight =
      this.frame00 * this.tangent.x + this.frame01 * this.tangent.y;
    const travelAhead =
      this.frame10 * this.tangent.x + this.frame11 * this.tangent.y;
    const travelLength = Math.hypot(travelRight, travelAhead);
    const unitRight = travelLength > 0 ? travelRight / travelLength : 0;
    const unitAhead = travelLength > 0 ? travelAhead / travelLength : 1;
    right -= unitAhead * lateral;
    ahead += unitRight * lateral;
    output.x = this.centreX + right * this.pixelsPerMetre;
    output.y = this.centreY - ahead * this.pixelsPerMetre;
    output.angle = Math.atan2(-unitAhead, unitRight);
    return output;
  }
}
