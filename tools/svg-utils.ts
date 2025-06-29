import { svgPathProperties } from 'svg-path-properties';

// Function to find the intersection of two lines
export const lineIntersection = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
) => {
  const denominator =
    (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denominator === 0) return null;

  const ua =
    ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) /
    denominator;
  const ub =
    ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) /
    denominator;

  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;

  const x = p1.x + ua * (p2.x - p1.x);
  const y = p1.y + ua * (p2.y - p1.y);

  return { x, y };
};

// Find the intersection point using a more efficient approach
export const findIntersectionPoint = (
  path1: string, // Inside path
  path2: string // Start/Finish path
) => {
  if (!path1 || !path2) return null;

  const p1 = new svgPathProperties(path1);
  const p2 = new svgPathProperties(path2);

  const path1Length = p1.getTotalLength();
  const path2Length = p2.getTotalLength();
  const initialStep = Math.max(path1Length, path2Length) / 500; // Initial coarse step

  for (let i = 0; i < path1Length; i += initialStep) {
    const point1 = p1.getPointAtLength(i);
    const point2 = p1.getPointAtLength(Math.min(i + initialStep, path1Length));

    for (let j = 0; j < path2Length; j += initialStep) {
      const point3 = p2.getPointAtLength(j);
      const point4 = p2.getPointAtLength(
        Math.min(j + initialStep, path2Length)
      );

      // Skip if bounding boxes don't overlap
      const bbox1 = {
        xMin: Math.min(point1.x, point2.x),
        xMax: Math.max(point1.x, point2.x),
        yMin: Math.min(point1.y, point2.y),
        yMax: Math.max(point1.y, point2.y),
      };
      const bbox2 = {
        xMin: Math.min(point3.x, point4.x),
        xMax: Math.max(point3.x, point4.x),
        yMin: Math.min(point3.y, point4.y),
        yMax: Math.max(point3.y, point4.y),
      };

      if (
        bbox1.xMax < bbox2.xMin ||
        bbox1.xMin > bbox2.xMax ||
        bbox1.yMax < bbox2.yMin ||
        bbox1.yMin > bbox2.yMax
      ) {
        continue; // No overlap, skip
      }

      // Check intersection if bounding boxes overlap
      const intersection = lineIntersection(point1, point2, point3, point4);

      if (intersection) {
        return { x: intersection.x, y: intersection.y, length: i };
      }
    }
  }

  return null;
};

// Function to find the direction of the track based on the order of turns
// looks at the position of the first two turns to determine the direction
export const findDirection = (trackId: number) => {
  if (
    [
      3, 8, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
      37, 39, 40, 47, 51, 52, 53, 94, 101, 103, 104, 105, 110, 113, 114, 115,
      116, 120, 121, 122, 123, 124, 129, 130, 131, 132, 133, 135, 136, 137, 138,
      143, 152, 158, 161, 162, 169, 170, 171, 175, 176, 178, 188, 189, 190, 191,
      192, 193, 198, 201, 202, 203, 204, 208, 211, 212, 213, 214, 215, 217, 225,
      226, 227, 229, 230, 231, 232, 235, 236, 237, 238, 245, 248, 256, 256, 256,
      266, 267, 271, 273, 274, 275, 276, 277, 279, 286, 287, 288, 295, 299, 303,
      304, 305, 314, 320, 330, 331, 334, 335, 339, 340, 344, 350, 351, 357, 362,
      364, 365, 366, 371, 373, 374, 380, 381, 382, 383, 384, 386, 387, 388, 398,
      400, 414, 418, 419, 424, 426, 428, 429, 430, 431, 437, 438, 442, 443, 446,
      447, 452, 453, 462, 475, 476, 477, 478, 479, 480, 481, 482, 488, 489, 493,
      494, 496, 497, 500, 506, 513, 514, 518, 519, 520, 522,
    ].includes(trackId)
  ) {
    return 'anticlockwise';
  }

  return 'clockwise';
};

// Number of pre calculated points (matches the quantization in TrackCanvas)
const PRE_CALCULATED_POINTS = 1000;

// Pre calculate pointAtLength values for a given SVG path
// this is used to find the position of the car based on the percentage of the track completed
export const preCalculatePoints = (pathData: string): { x: number; y: number }[] => {
  const path = new svgPathProperties(pathData);
  const totalLength = path.getTotalLength();
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= PRE_CALCULATED_POINTS; i++) {
    const length = (totalLength * i) / PRE_CALCULATED_POINTS;
    const point = path.getPointAtLength(length);
    points.push({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  return points;
}
