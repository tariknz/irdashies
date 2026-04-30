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

// Pre-allocated indices array (reused across renders)
let cachedIndices: number[] = [];
function getIndices(bufferSize: number): number[] {
  if (cachedIndices.length !== bufferSize) {
    cachedIndices = Array.from({ length: bufferSize }, (_, i) => i);
  }
  return cachedIndices;
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

  const { width, height } = { width: 400, height: 100 };
  const bufferSize = maxSamples;

  // Refs for persistent SVG path elements
  const throttlePathRef = useRef<SVGPathElement>(null);
  const brakePathRef = useRef<SVGPathElement>(null);
  const brakeAbsPathRef = useRef<SVGPathElement>(null);
  const clutchPathRef = useRef<SVGPathElement>(null);
  const steerPathRef = useRef<SVGPathElement>(null);
  const rafRef = useRef<number | null>(null);

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

  // Pre-compute scales (only change if dimensions change)
  const { xScale, yScale } = useMemo(() => {
    const scaleMargin = 0.05;
    return {
      xScale: d3
        .scaleLinear()
        .domain([0, bufferSize - 1])
        .range([0, width]),
      yScale: d3
        .scaleLinear()
        .domain([0 - scaleMargin, 1 + scaleMargin])
        .range([height, 0]),
    };
  }, [bufferSize, width, height]);

  // Pre-compute gridline Y positions
  const gridlines = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((tick) => ({ tick, y: yScale(tick) })),
    [yScale]
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
      const wi = writeIndex.current;
      const indices = getIndices(bufferSize);

      // Helper to generate path d string for a standard line
      const generatePathD = (values: number[]) => {
        const line = d3
          .line<number>()
          .x((i) => xScale(i))
          .y((i) => {
            const pi = (wi + i) % bufferSize;
            return yScale(Math.max(0, Math.min(1, values[pi])));
          })
          .curve(d3.curveBasis);
        return line(indices) ?? '';
      };

      // Helper for centered line (steering)
      const generateCenteredPathD = (values: number[]) => {
        const centerY = height / 2;
        const line = d3
          .line<number>()
          .x((i) => xScale(i))
          .y((i) => {
            const pi = (wi + i) % bufferSize;
            const d = values[pi];
            return centerY - (d - 0.5) * height;
          })
          .curve(d3.curveBasis);
        return line(indices) ?? '';
      };

      // Update path d attributes directly on persistent DOM elements
      if (includeSteer && steerPathRef.current) {
        steerPathRef.current.setAttribute(
          'd',
          generateCenteredPathD(steerArray.current)
        );
      }
      if (includeClutch && clutchPathRef.current) {
        clutchPathRef.current.setAttribute(
          'd',
          generatePathD(clutchArray.current)
        );
      }
      if (includeThrottle && throttlePathRef.current) {
        throttlePathRef.current.setAttribute(
          'd',
          generatePathD(throttleArray.current)
        );
      }
      if (includeBrake) {
        if (includeAbs) {
          // Draw full brake line in normal color, ABS segments overlay on top
          if (brakePathRef.current) {
            brakePathRef.current.setAttribute(
              'd',
              generatePathD(brakeArray.current)
            );
          }
          if (brakeAbsPathRef.current) {
            const absLine = d3
              .line<number>()
              .x((i) => xScale(i))
              .y((i) => {
                const pi = (wi + i) % bufferSize;
                return yScale(Math.max(0, Math.min(1, brakeArray.current[pi])));
              })
              .defined((i) => {
                const pi = (wi + i) % bufferSize;
                return brakeABSArray.current[pi];
              })
              .curve(d3.curveBasis);
            brakeAbsPathRef.current.setAttribute('d', absLine(indices) ?? '');
          }
        } else {
          if (brakePathRef.current) {
            brakePathRef.current.setAttribute(
              'd',
              generatePathD(brakeArray.current)
            );
          }
        }
      }
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
      width={'100%'}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {/* Static gridlines - rendered once by React */}
      {gridlines.map(({ tick, y }) => (
        <line
          key={tick}
          x1={0}
          x2={width}
          y1={y}
          y2={y}
          stroke="#666"
          strokeDasharray="2,2"
        />
      ))}
      {/* Persistent path elements - only d attribute is updated each frame */}
      {includeSteer && (
        <path
          ref={steerPathRef}
          fill="none"
          stroke={STEER_COLOR}
          strokeWidth={1}
        />
      )}
      {includeClutch && (
        <path
          ref={clutchPathRef}
          fill="none"
          stroke={CLUTCH_COLOR}
          strokeWidth={strokeWidth}
        />
      )}
      {includeThrottle && (
        <path
          ref={throttlePathRef}
          fill="none"
          stroke={THROTTLE_COLOR}
          strokeWidth={strokeWidth}
        />
      )}
      {includeBrake && (
        <>
          <path
            ref={brakePathRef}
            fill="none"
            stroke={BRAKE_COLOR}
            strokeWidth={strokeWidth}
          />
          {includeAbs && (
            <path
              ref={brakeAbsPathRef}
              fill="none"
              stroke={BRAKE_ABS_COLOR}
              strokeWidth={Math.round(strokeWidth * 1.67)}
            />
          )}
        </>
      )}
    </svg>
  );
};
