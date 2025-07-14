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
  // Track IDs that run anticlockwise
  const anticlockwiseTracks = [
    3, 11, 12, 14, 16, 17, 18, 19, 23, 26, 27, 28, 30, 31, 33, 37, 39, 40,
    46, 47, 49, 50, 94, 99, 100, 103, 104, 105, 110, 113, 114, 116, 120, 121,
    122, 123, 124, 129, 130, 131, 132, 133, 135, 136, 137, 138, 143, 145, 146,
    152, 158, 161, 169, 170, 171, 172, 178, 179, 188, 189, 190, 191, 192, 195,
    196, 198, 201, 203, 204, 205, 212, 213, 216, 218, 219, 222, 223, 228, 235,
    236, 245, 249, 250, 252, 253, 255, 256, 257, 262, 263, 264, 266, 267, 274,
    275, 276, 277, 279, 286, 288, 295, 297, 298, 299, 304, 305, 320, 322, 323,
    332, 333, 336, 337, 338, 343, 350, 351, 357, 364, 365, 366, 371, 381, 386,
    397, 398, 404, 405, 407, 413, 414, 418, 424, 426, 427, 429, 431, 436, 438,
    443, 444, 445, 448, 449, 451, 453, 454, 455, 456, 463, 469, 473, 474, 481,
    483, 498, 514, 522, 526, 559, 561,
  ];

  return anticlockwiseTracks.includes(trackId) ? 'anticlockwise' : 'clockwise';
};

// Pre calculate pointAtLength values for a given SVG path
// this is used to find the position of the car based on the percentage of the track completed
export const preCalculatePoints = (pathData: string): { x: number; y: number }[] => {
  const path = new svgPathProperties(pathData);
  const totalLength = path.getTotalLength();
  
  // Calculate number of points based on path length
  // Aim for roughly 1 point per 2-3 pixels of path length for good resolution
  const pointsPerPixel = 0.4; // Adjust this value to control density
  const calculatedPoints = Math.max(500, Math.min(2000, Math.round(totalLength * pointsPerPixel)));
  
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= calculatedPoints; i++) {
    const length = (totalLength * i) / calculatedPoints;
    const point = path.getPointAtLength(length);
    points.push({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  return points;
}
