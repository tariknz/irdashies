import * as d3 from 'd3';
import { useEffect, useRef, useMemo } from 'react';
import { getColor } from '@irdashies/utils/colors';

const BRAKE_COLOR = getColor('red');
const BRAKE_ABS_COLOR = getColor('yellow', 500);
const THROTTLE_COLOR = getColor('green');
const CLUTCH_COLOR = getColor('blue');
const STEER_COLOR = getColor('slate', 300);

export interface InputTraceProps {
  input: {
    clutch?: number;
    brake?: number;
    brakeAbsActive?: boolean;
    throttle?: number;
    steer?: number;
  };
  settings?: {
    includeClutch?: boolean;
    includeThrottle?: boolean;
    includeBrake?: boolean;
    includeAbs?: boolean;
    includeSteer?: boolean;
    strokeWidth?: number;
    maxSamples?: number;
  };
}

export const InputTrace = ({ input, settings }: InputTraceProps) => {
  const {
    includeClutch = true,
    includeThrottle = true,
    includeBrake = true,
    includeAbs = true,
    includeSteer = true,
    strokeWidth = 3,
    maxSamples = 400,
  } = settings ?? {};
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const { width, height } = { width: 400, height: 100 };

  const bufferSize = maxSamples;

  // Circular buffers - pre-allocated arrays that are reused
  const brakeArray = useRef<number[]>(
    Array.from({ length: bufferSize }, () => 0)
  );
  const brakeABSArray = useRef<boolean[]>(
    Array.from({ length: bufferSize }, () => false)
  );
  const throttleArray = useRef<number[]>(
    Array.from({ length: bufferSize }, () => 0)
  );
  const steerArray = useRef<number[]>(
    Array.from({ length: bufferSize }, () => 0.5)
  );
  const clutchArray = useRef<number[]>(
    Array.from({ length: bufferSize }, () => 0)
  );

  // Write index for circular buffer (oldest data point position)
  const writeIndex = useRef<number>(0);

  // Memoize scales since width/height are stable
  const xScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, bufferSize - 1])
        .range([0, width]),
    [bufferSize, width]
  );
  const yScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0 - 0.05, 1 + 0.05])
        .range([height, 0]),
    [height]
  );

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const idx = writeIndex.current;

      // Update arrays in-place at current write position
      if (includeThrottle) {
        throttleArray.current[idx] = input.throttle ?? 0;
      }
      if (includeBrake) {
        brakeArray.current[idx] = input.brake ?? 0;
        if (includeAbs) {
          brakeABSArray.current[idx] = input.brakeAbsActive ?? false;
        }
      }
      if (includeClutch) {
        clutchArray.current[idx] = input.clutch ?? 0;
      }
      if (includeSteer) {
        const angleRad = input.steer ?? 0;
        const normalizedValue = Math.max(
          0,
          Math.min(1, angleRad / (2 * Math.PI) + 0.5)
        );
        steerArray.current[idx] = normalizedValue;
      }

      // Move write index forward (circular)
      writeIndex.current = (idx + 1) % bufferSize;

      // Draw immediately in the same RAF callback
      const valueArrayWithColors = [];
      if (includeSteer) {
        valueArrayWithColors.push({
          id: 'steer',
          values: steerArray.current,
          color: STEER_COLOR,
          isCentered: true,
        });
      }
      if (includeClutch)
        valueArrayWithColors.push({
          id: 'clutch',
          values: clutchArray.current,
          color: CLUTCH_COLOR,
        });
      if (includeThrottle)
        valueArrayWithColors.push({
          id: 'throttle',
          values: throttleArray.current,
          color: THROTTLE_COLOR,
        });
      if (includeBrake) {
        valueArrayWithColors.push({
          id: 'brake',
          values: brakeArray.current,
          color: BRAKE_COLOR,
          absStates: includeAbs ? brakeABSArray.current : undefined,
          absColor: includeAbs ? BRAKE_ABS_COLOR : undefined,
        });
      }

      drawGraph(
        svgRef.current,
        valueArrayWithColors,
        width,
        height,
        strokeWidth,
        bufferSize,
        writeIndex.current,
        xScale,
        yScale
      );
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    input,
    includeThrottle,
    includeBrake,
    includeAbs,
    includeSteer,
    includeClutch,
    bufferSize,
    width,
    height,
    strokeWidth,
    xScale,
    yScale,
  ]);

  return (
    <svg
      ref={svgRef}
      width={'100%'}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    ></svg>
  );
};

// Helper to read from circular buffer at logical index
function getCircularValue<T>(
  array: T[],
  logicalIndex: number,
  writeIndex: number,
  bufferSize: number
): T {
  const physicalIndex = (writeIndex + logicalIndex) % bufferSize;
  return array[physicalIndex];
}

// Pre-allocated indices array (reused across renders)
let cachedIndices: number[] = [];
function getIndices(bufferSize: number): number[] {
  if (cachedIndices.length !== bufferSize) {
    cachedIndices = Array.from({ length: bufferSize }, (_, i) => i);
  }
  return cachedIndices;
}

function drawGraph(
  svgElement: SVGSVGElement | null,
  valueArrayWithColors: {
    id: string;
    values: number[] | boolean[];
    color: string;
    absStates?: boolean[];
    absColor?: string;
    isCentered?: boolean;
  }[],
  width: number,
  height: number,
  strokeWidth: number,
  bufferSize: number,
  writeIndex: number,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>
) {
  if (!svgElement || valueArrayWithColors.length === 0) return;

  const svg = d3.select(svgElement);

  // Initialize axes if they don't exist
  let yAxisG = svg.select<SVGGElement>('g.y-axis');
  if (yAxisG.empty()) {
    yAxisG = svg.append('g').attr('class', 'y-axis');
    drawYAxis(yAxisG, yScale, width);
  }

  // Draw directly from circular buffers using index mapper
  valueArrayWithColors.forEach(
    ({ id, values, color, absStates, absColor, isCentered }) => {
      let group = svg.select<SVGGElement>(`g.group-${id}`);
      if (group.empty()) {
        group = svg.append('g').attr('class', `group-${id}`);
      }

      if (absStates && absColor) {
        drawABSAwareLine(
          group,
          values as number[],
          absStates,
          xScale,
          yScale,
          color,
          absColor,
          strokeWidth,
          writeIndex,
          bufferSize
        );
      } else if (isCentered) {
        drawCenteredLine(
          group,
          values as number[],
          xScale,
          yScale,
          color,
          height,
          writeIndex,
          bufferSize
        );
      } else {
        drawLine(
          group,
          values as number[],
          xScale,
          yScale,
          color,
          strokeWidth,
          writeIndex,
          bufferSize
        );
      }
    }
  );

  // Remove any groups that are no longer needed
  const activeIds = valueArrayWithColors.map((d) => d.id);
  svg
    .selectAll('g[class^="group-"]')
    .filter(function () {
      const className = d3.select(this).attr('class');
      const id = className.replace('group-', '');
      return !activeIds.includes(id);
    })
    .remove();
}

function drawYAxis(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  yScale: d3.ScaleLinear<number, number>,
  width: number
) {
  const yAxis = d3
    .axisLeft(yScale)
    .tickValues(d3.range(0, 1.25, 0.25))
    .tickFormat(() => '');

  container
    .call(yAxis)
    .selectAll('line')
    .attr('x2', width)
    .attr('stroke', '#666')
    .attr('stroke-dasharray', '2,2');

  container.select('.domain').remove();
}

function drawLine(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  valueArray: number[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  color: string,
  strokeWidth: number,
  writeIndex: number,
  bufferSize: number
) {
  const line = d3
    .line<number>()
    .x((i) => xScale(i))
    .y((i) => {
      const value = getCircularValue(valueArray, i, writeIndex, bufferSize);
      return yScale(Math.max(0, Math.min(1, value)));
    })
    .curve(d3.curveBasis);

  const path = container
    .selectAll<SVGPathElement, number[]>('path')
    .data([getIndices(bufferSize)]);

  path
    .enter()
    .append('path')
    .merge(path)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', strokeWidth)
    .attr('d', line);
}

function drawCenteredLine(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  valueArray: number[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  color: string,
  height: number,
  writeIndex: number,
  bufferSize: number
) {
  // For centered lines (steering), normalizedValue 0.5 = center (height/2)
  // normalizedValue 0 = top (left turn), normalizedValue 1 = bottom (right turn)
  const line = d3
    .line<number>()
    .x((i) => xScale(i))
    .y((i) => {
      const d = getCircularValue(valueArray, i, writeIndex, bufferSize);
      // Map normalized value (0-1 where 0.5 = center) to y position
      // When d = 0.5: y = height/2 (center)
      // When d = 0: y = height (top)
      // When d = 1: y = 0 (bottom)
      const centerY = height / 2;
      const offset = (d - 0.5) * height;
      return centerY - offset;
    })
    .curve(d3.curveBasis);

  const path = container
    .selectAll<SVGPathElement, number[]>('path')
    .data([getIndices(bufferSize)]);

  path
    .enter()
    .append('path')
    .merge(path)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 1)
    .attr('d', line);
}

function drawABSAwareLine(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  valueArray: number[],
  absStates: boolean[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  normalColor: string,
  absColor: string,
  strokeWidth: number,
  writeIndex: number,
  bufferSize: number
) {
  // Group consecutive points by ABS state, reading from circular buffer
  const segments: {
    values: { value: number; index: number }[];
    isABS: boolean;
  }[] = [];
  let currentSegment: { value: number; index: number }[] = [];
  let currentIsABS = getCircularValue(absStates, 0, writeIndex, bufferSize);

  for (let i = 0; i < bufferSize; i++) {
    const isABS = getCircularValue(absStates, i, writeIndex, bufferSize);
    const value = getCircularValue(valueArray, i, writeIndex, bufferSize);

    if (i === 0 || isABS === currentIsABS) {
      currentSegment.push({ value, index: i });
    } else {
      // ABS state changed, finish current segment
      if (currentSegment.length > 0) {
        segments.push({ values: [...currentSegment], isABS: currentIsABS });
      }

      // Start new segment with overlap point for continuity
      currentSegment = [
        currentSegment[currentSegment.length - 1],
        { value, index: i },
      ];
      currentIsABS = isABS;
    }
  }

  // Add the final segment
  if (currentSegment.length > 0) {
    segments.push({ values: currentSegment, isABS: currentIsABS });
  }

  const paths = container
    .selectAll<
      SVGPathElement,
      { values: { value: number; index: number }[]; isABS: boolean }
    >('path')
    .data(segments);

  paths
    .enter()
    .append('path')
    .merge(paths)
    .attr('fill', 'none')
    .attr('stroke', (d) => (d.isABS ? absColor : normalColor))
    .attr('stroke-width', (d) =>
      d.isABS ? Math.round(strokeWidth * 1.67) : strokeWidth
    )
    .attr('d', (d) => {
      const line = d3
        .line<{ value: number; index: number }>()
        .x((p) => xScale(p.index))
        .y((p) => yScale(Math.max(0, Math.min(1, p.value))))
        .curve(d3.curveBasis);
      return line(d.values);
    });

  paths.exit().remove();
}
