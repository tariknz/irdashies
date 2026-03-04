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

// Extract a path as a sequence of {x1,y1,x2,y2} line segments by parsing SVG
// path commands. Arcs and curves are approximated as chords (start→end point).
// This is used as a fallback when svg-path-properties cannot parse the path
// (e.g. degenerate arcs where chord length exceeds diameter).
const extractSegmentsFromPath = (
  d: string
): { x1: number; y1: number; x2: number; y2: number }[] => {
  const NUM_RE = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi;
  const CMD_RE = /([MmLlHhVvAaCcSsQqTtZz])([^MmLlHhVvAaCcSsQqTtZz]*)/g;
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let cx = 0,
    cy = 0,
    startX = 0,
    startY = 0;

  let match: RegExpExecArray | null;
  while ((match = CMD_RE.exec(d)) !== null) {
    const cmd = match[1];
    const nums = (match[2].match(NUM_RE) || []).map(Number);
    const rel = cmd === cmd.toLowerCase() && cmd !== 'Z' && cmd !== 'z';

    switch (cmd.toUpperCase()) {
      case 'M': {
        cx = rel ? cx + nums[0] : nums[0];
        cy = rel ? cy + nums[1] : nums[1];
        startX = cx;
        startY = cy;
        break;
      }
      case 'L': {
        const nx = rel ? cx + nums[0] : nums[0];
        const ny = rel ? cy + nums[1] : nums[1];
        segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx;
        cy = ny;
        break;
      }
      case 'H': {
        const nx = rel ? cx + nums[0] : nums[0];
        segments.push({ x1: cx, y1: cy, x2: nx, y2: cy });
        cx = nx;
        break;
      }
      case 'V': {
        const ny = rel ? cy + nums[0] : nums[0];
        segments.push({ x1: cx, y1: cy, x2: cx, y2: ny });
        cy = ny;
        break;
      }
      case 'A': {
        // Arc: approximate as chord from current to endpoint
        const nx = rel ? cx + nums[5] : nums[5];
        const ny = rel ? cy + nums[6] : nums[6];
        segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx;
        cy = ny;
        break;
      }
      case 'C': {
        const nx = rel ? cx + nums[4] : nums[4];
        const ny = rel ? cy + nums[5] : nums[5];
        segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx;
        cy = ny;
        break;
      }
      case 'S':
      case 'Q': {
        const nx = rel ? cx + nums[2] : nums[2];
        const ny = rel ? cy + nums[3] : nums[3];
        segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx;
        cy = ny;
        break;
      }
      case 'T': {
        const nx = rel ? cx + nums[0] : nums[0];
        const ny = rel ? cy + nums[1] : nums[1];
        segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx;
        cy = ny;
        break;
      }
      case 'Z': {
        segments.push({ x1: cx, y1: cy, x2: startX, y2: startY });
        cx = startX;
        cy = startY;
        break;
      }
    }
  }
  return segments;
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

  if (isNaN(path1Length)) return null;

  const step1 = path1Length / 500;

  // When path2Length is NaN, svg-path-properties cannot parse path2 (e.g. due to
  // a degenerate arc where chord > diameter). In that case getPointAtLength always
  // returns the initial point, making sampling useless. Fall back to extracting
  // explicit line segments from the path string instead.
  const path2Segments = isNaN(path2Length)
    ? extractSegmentsFromPath(path2)
    : null;

  for (let i = 0; i < path1Length; i += step1) {
    const point1 = p1.getPointAtLength(i);
    const point2 = p1.getPointAtLength(Math.min(i + step1, path1Length));

    const bbox1 = {
      xMin: Math.min(point1.x, point2.x),
      xMax: Math.max(point1.x, point2.x),
      yMin: Math.min(point1.y, point2.y),
      yMax: Math.max(point1.y, point2.y),
    };

    if (path2Segments) {
      for (const seg of path2Segments) {
        const point3 = { x: seg.x1, y: seg.y1 };
        const point4 = { x: seg.x2, y: seg.y2 };

        if (
          bbox1.xMax < Math.min(point3.x, point4.x) ||
          bbox1.xMin > Math.max(point3.x, point4.x) ||
          bbox1.yMax < Math.min(point3.y, point4.y) ||
          bbox1.yMin > Math.max(point3.y, point4.y)
        ) {
          continue;
        }

        const intersection = lineIntersection(point1, point2, point3, point4);
        if (intersection) {
          return { x: intersection.x, y: intersection.y, length: i };
        }
      }
    } else {
      const step2 = path2Length / 100;
      for (let j = 0; j < path2Length; j += step2) {
        const point3 = p2.getPointAtLength(j);
        const point4 = p2.getPointAtLength(Math.min(j + step2, path2Length));

        // Skip if bounding boxes don't overlap
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
  }

  return null;
};

export const getLengthAtPoint = (
  path: string,
  point: { x: number; y: number }
): number => {
  if (!path) return 0;
  const p = new svgPathProperties(path);
  const totalLength = p.getTotalLength();
  const step = totalLength / 500;
  let bestLength = 0;
  let bestDistSq = Infinity;
  for (let length = 0; length <= totalLength; length += step) {
    const pt = p.getPointAtLength(Math.min(length, totalLength));
    const distSq = Math.pow(pt.x - point.x, 2) + Math.pow(pt.y - point.y, 2);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestLength = length;
    }
  }
  const lo = Math.max(0, bestLength - step);
  const hi = Math.min(totalLength, bestLength + step);
  const fineStep = (hi - lo) / 100;
  let best = bestLength;
  let bestD = bestDistSq;
  for (let length = lo; length <= hi; length += fineStep) {
    const pt = p.getPointAtLength(length);
    const d = Math.pow(pt.x - point.x, 2) + Math.pow(pt.y - point.y, 2);
    if (d < bestD) {
      bestD = d;
      best = length;
    }
  }
  return best;
};

// Function to find the direction of the track based on the order of turns
// looks at the position of the first two turns to determine the direction
export const findDirection = (trackId: number) => {
  // Track IDs that run anticlockwise (in reference to the SVG path, not necessarily the real track's direction)
  const anticlockwiseTracks = [
    3, 8, 11, 12, 14, 16, 17, 18, 19, 23, 26, 27, 28, 30, 31, 33, 37, 39, 40,
    46, 47, 49, 50, 94, 99, 100, 103, 104, 105, 110, 113, 114, 116, 120, 121,
    122, 123, 124, 129, 130, 131, 132, 133, 135, 136, 137, 138, 143, 145, 146,
    152, 158, 161, 169, 170, 171, 172, 178, 179, 188, 189, 190, 191, 192, 195,
    196, 198, 201, 203, 204, 205, 212, 213, 216, 218, 219, 222, 223, 228, 235,
    236, 245, 249, 250, 252, 253, 255, 256, 257, 262, 263, 264, 266, 267, 274,
    275, 276, 277, 279, 286, 288, 295, 297, 298, 299, 304, 305, 320, 322, 323,
    332, 333, 336, 337, 338, 343, 350, 351, 357, 364, 365, 366, 371, 381, 386,
    397, 398, 404, 405, 407, 413, 414, 418, 424, 426, 427, 429, 431, 436, 438,
    443, 444, 445, 448, 449, 451, 453, 454, 455, 456, 463, 469, 473, 474, 481,
    483, 498, 509, 510, 511, 512, 514, 515, 516, 517, 518, 519, 520, 522, 526,
    527, 528, 529, 530, 532, 536, 537, 540, 541, 542, 543, 544, 545, 546, 551,
    559, 561, 562, 563, 564, 565, 566, 567, 568, 569, 570, 571, 572, 573, 574,
    575, 576, 577, 580,
  ];

  return anticlockwiseTracks.includes(trackId) ? 'anticlockwise' : 'clockwise';
};

// Pre calculate pointAtLength values for a given SVG path
// this is used to find the position of the car based on the percentage of the track completed
export const preCalculatePoints = (
  pathData: string
): { x: number; y: number }[] => {
  const path = new svgPathProperties(pathData);
  const totalLength = path.getTotalLength();

  // Calculate number of points based on path length
  // Aim for roughly 1 point per 2-3 pixels of path length for good resolution
  const pointsPerPixel = 0.4; // Adjust this value to control density
  const calculatedPoints = Math.max(
    500,
    Math.min(2000, Math.round(totalLength * pointsPerPixel))
  );

  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= calculatedPoints; i++) {
    const length = (totalLength * i) / calculatedPoints;
    const point = path.getPointAtLength(length);
    points.push({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  return points;
};

// Convert line element to path data
export const lineToPath = (line: SVGLineElement): string => {
  const x1 = parseFloat(line.getAttribute('x1') || '0');
  const y1 = parseFloat(line.getAttribute('y1') || '0');
  const x2 = parseFloat(line.getAttribute('x2') || '0');
  const y2 = parseFloat(line.getAttribute('y2') || '0');
  return `M${x1},${y1}L${x2},${y2}`;
};

// Convert rect element to path data
export const rectToPath = (rect: SVGRectElement): string => {
  const x = parseFloat(rect.getAttribute('x') || '0');
  const y = parseFloat(rect.getAttribute('y') || '0');
  const width = parseFloat(rect.getAttribute('width') || '0');
  const height = parseFloat(rect.getAttribute('height') || '0');

  // Handle transform if present
  const transform = rect.getAttribute('transform');
  if (transform) {
    // For simplicity, we'll use the center line of the rect
    // This should work for most start-finish lines
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Create a simple line through the center of the rect
    // For rotated rects, we'll use the longer dimension
    const isRotated = transform.includes('rotate');
    if (isRotated) {
      // For rotated rects, use the diagonal
      const halfLength = Math.sqrt(width * width + height * height) / 2;
      return `M${centerX - halfLength},${centerY}L${centerX + halfLength},${centerY}`;
    } else {
      // For non-rotated rects, use the center line
      return `M${centerX},${y}L${centerX},${y + height}`;
    }
  }

  // For non-rotated rects, use the center line
  const centerX = x + width / 2;
  return `M${centerX},${y}L${centerX},${y + height}`;
};

// Parse an SVG transform string into a 2D matrix [a,b,c,d,e,f]
// where: x' = a*x + c*y + e,  y' = b*x + d*y + f
const parseTransformMatrix = (
  transform: string
): [number, number, number, number, number, number] => {
  type Mat = [number, number, number, number, number, number];
  let mat: Mat = [1, 0, 0, 1, 0, 0];

  const multiply = (m1: Mat, m2: Mat): Mat => [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];

  const funcRe = /(matrix|translate|scale|rotate|skewX|skewY)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = funcRe.exec(transform)) !== null) {
    const func = match[1];
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    let m: Mat;
    switch (func) {
      case 'translate':
        m = [1, 0, 0, 1, args[0], args[1] ?? 0];
        break;
      case 'scale':
        m = [args[0], 0, 0, args[1] ?? args[0], 0, 0];
        break;
      case 'rotate': {
        const angle = (args[0] * Math.PI) / 180;
        const c = Math.cos(angle),
          s = Math.sin(angle);
        if (args.length >= 3) {
          const [, cx, cy] = args;
          m = [c, s, -s, c, cx * (1 - c) + cy * s, cy * (1 - c) - cx * s];
        } else {
          m = [c, s, -s, c, 0, 0];
        }
        break;
      }
      case 'matrix':
        m = args as Mat;
        break;
      default:
        continue;
    }
    mat = multiply(mat, m);
  }
  return mat;
};

const applyMatrix = (
  mat: [number, number, number, number, number, number],
  x: number,
  y: number
) => ({
  x: mat[0] * x + mat[2] * y + mat[4],
  y: mat[1] * x + mat[3] * y + mat[5],
});

// Extract start-finish line data from various SVG element types
export const extractStartFinishData = (
  svg: SVGSVGElement
): { line: string; arrow: string } | null => {
  // Try to find use elements with symbol references first (for complex SVGs)
  const useElements = svg.querySelectorAll('use');
  if (useElements.length >= 2) {
    // Look for start-finish line and arrow symbols
    let linePath = '';
    let arrowPath = '';

    for (const useEl of useElements) {
      const href =
        useEl.getAttribute('href') || useEl.getAttribute('xlink:href');
      const transform = useEl.getAttribute('transform') || '';

      if (href) {
        const symbolId = href.replace('#', '');
        const symbol = svg.querySelector(`symbol[id="${symbolId}"]`);

        if (symbol) {
          const mat = parseTransformMatrix(transform);

          // Check if this is a line (rect) or arrow (polygon)
          const rect = symbol.querySelector('rect');
          const polygon = symbol.querySelector('polygon');

          if (rect) {
            const x = parseFloat(rect.getAttribute('x') || '0');
            const y = parseFloat(rect.getAttribute('y') || '0');
            const width = parseFloat(rect.getAttribute('width') || '0');
            const height = parseFloat(rect.getAttribute('height') || '0');

            const centerX = x + width / 2;
            const p1 = applyMatrix(mat, centerX, y);
            const p2 = applyMatrix(mat, centerX, y + height);

            linePath = `M${p1.x},${p1.y}L${p2.x},${p2.y}`;
          } else if (polygon) {
            const points = polygon.getAttribute('points');
            if (points) {
              const coords = points
                .trim()
                .split(/\s+/)
                .map(parseFloat)
                .filter((n) => !isNaN(n));
              const transformedPoints: string[] = [];
              for (let i = 0; i < coords.length; i += 2) {
                if (i + 1 < coords.length) {
                  const p = applyMatrix(mat, coords[i], coords[i + 1]);
                  transformedPoints.push(`${p.x},${p.y}`);
                }
              }
              if (transformedPoints.length >= 3) {
                arrowPath = `M${transformedPoints[0]}L${transformedPoints.slice(1).join('L')}Z`;
              }
            }
          }
        }
      }
    }

    if (linePath && arrowPath) {
      return { line: linePath, arrow: arrowPath };
    }
  }

  // Try to find line + path combination (most common case)
  const line = svg.querySelector('line');
  const pathArrow = svg.querySelector('path');
  if (line && pathArrow) {
    const linePath = lineToPath(line);
    const arrowPath = pathArrow.getAttribute('d')?.replace(/\s/g, '') || '';
    if (linePath && arrowPath) {
      return { line: linePath, arrow: arrowPath };
    }
  }

  // Try to find path elements (existing logic)
  const paths = svg.querySelectorAll('path');
  if (paths.length >= 2) {
    const line = paths[0]?.getAttribute('d')?.replace(/\s/g, '') || '';
    const arrow = paths[1]?.getAttribute('d')?.replace(/\s/g, '') || '';
    if (line && arrow) {
      return { line, arrow };
    }
  }

  // Try to find single path element (for tracks with combined line+arrow)
  if (paths.length === 1) {
    const pathData = paths[0]?.getAttribute('d')?.replace(/\s/g, '') || '';
    if (pathData) {
      // For single path, we'll use it as both line and arrow
      // The intersection logic will determine which one works
      return { line: pathData, arrow: pathData };
    }
  }

  // Try to find rect + polygon combination
  const rect = svg.querySelector('rect');
  const polygon = svg.querySelector('polygon');
  if (rect && polygon) {
    const rectPath = rectToPath(rect);
    const polygonPath = polygon.getAttribute('points');
    if (rectPath && polygonPath) {
      // Convert polygon points to path
      // Points are space-separated pairs like "x1 y1 x2 y2 x3 y3"
      const coords = polygonPath
        .trim()
        .split(/\s+/)
        .map(parseFloat)
        .filter((n) => !isNaN(n));
      const points = [];
      for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 < coords.length) {
          points.push([coords[i], coords[i + 1]]);
        }
      }

      if (points.length >= 3) {
        const polygonPathData = `M${points[0][0]},${points[0][1]}L${points
          .slice(1)
          .map((p) => `${p[0]},${p[1]}`)
          .join('L')}Z`;
        return { line: rectPath, arrow: polygonPathData };
      }
    }
  }

  // Try to find rect + path combination
  if (rect && pathArrow) {
    const rectPath = rectToPath(rect);
    const arrowPath = pathArrow.getAttribute('d')?.replace(/\s/g, '') || '';
    if (rectPath && arrowPath) {
      return { line: rectPath, arrow: arrowPath };
    }
  }

  return null;
};
