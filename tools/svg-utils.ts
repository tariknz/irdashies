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
    483, 498, 511, 512, 514, 518, 519, 520, 522, 526, 527, 528, 529, 530, 532, 
    540, 541, 542, 543, 544, 545, 546, 551, 559, 561, 562, 563, 564, 565, 567, 
    568, 569, 570, 571, 572, 573, 574, 575, 576, 577, 580
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

// Convert line element to path data
export const lineToPath = (line: SVGLineElement): string => {
  const x1 = parseFloat(line.getAttribute('x1') || '0');
  const y1 = parseFloat(line.getAttribute('y1') || '0');
  const x2 = parseFloat(line.getAttribute('x2') || '0');
  const y2 = parseFloat(line.getAttribute('y2') || '0');
  return `M${x1},${y1}L${x2},${y2}`;
}

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
}

// Extract start-finish line data from various SVG element types
export const extractStartFinishData = (svg: SVGSVGElement): { line: string; arrow: string } | null => {
  // Try to find use elements with symbol references first (for complex SVGs)
  const useElements = svg.querySelectorAll('use');
  if (useElements.length >= 2) {
    // Look for start-finish line and arrow symbols
    let linePath = '';
    let arrowPath = '';
    
    for (const useEl of useElements) {
      const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href');
      const transform = useEl.getAttribute('transform') || '';
      
      if (href) {
        const symbolId = href.replace('#', '');
        const symbol = svg.querySelector(`symbol[id="${symbolId}"]`);
        
        if (symbol) {
          // Extract transform values
          const translateMatch = transform.match(/translate\(([^,\s]+)\s+([^)]+)\)/);
          const translateX = translateMatch ? parseFloat(translateMatch[1]) : 0;
          const translateY = translateMatch ? parseFloat(translateMatch[2]) : 0;
          
          // Check if this is a line (rect) or arrow (polygon)
          const rect = symbol.querySelector('rect');
          const polygon = symbol.querySelector('polygon');
          
          if (rect) {
            // Convert rect to path and apply transform
            const x = parseFloat(rect.getAttribute('x') || '0');
            const y = parseFloat(rect.getAttribute('y') || '0');
            const width = parseFloat(rect.getAttribute('width') || '0');
            const height = parseFloat(rect.getAttribute('height') || '0');
            
            // Create line through center of rect
            const centerX = x + width / 2;
            const lineX1 = translateX + centerX;
            const lineY1 = translateY + y;
            const lineX2 = translateX + centerX;
            const lineY2 = translateY + y + height;
            
            linePath = `M${lineX1},${lineY1}L${lineX2},${lineY2}`;
          } else if (polygon) {
            // Convert polygon to path and apply transform
            const points = polygon.getAttribute('points');
            if (points) {
              const coords = points.trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
              const transformedPoints = [];
              for (let i = 0; i < coords.length; i += 2) {
                if (i + 1 < coords.length) {
                  transformedPoints.push(`${coords[i] + translateX},${coords[i + 1] + translateY}`);
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
      const coords = polygonPath.trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
      const points = [];
      for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 < coords.length) {
          points.push([coords[i], coords[i + 1]]);
        }
      }
      
      if (points.length >= 3) {
        const polygonPathData = `M${points[0][0]},${points[0][1]}L${points.slice(1).map(p => `${p[0]},${p[1]}`).join('L')}Z`;
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
}
