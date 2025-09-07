import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { getColor } from '@irdashies/utils/colors';

const BRAKE_COLOR = getColor('red');
const BRAKE_ABS_COLOR = getColor('yellow', 500);
const THROTTLE_COLOR = getColor('green');

export interface InputTraceProps {
  input: {
    brake?: number;
    brakeAbsActive?: boolean;
    throttle?: number;
  };
  settings?: {
    includeThrottle?: boolean;
    includeBrake?: boolean;
    includeAbs?: boolean;
  };
}

export const InputTrace = ({
  input,
  settings = { includeThrottle: true, includeBrake: true, includeAbs: true },
}: InputTraceProps) => {
  const { includeThrottle, includeBrake, includeAbs = true } = settings;
  const svgRef = useRef<SVGSVGElement>(null);
  const { width, height } = { width: 400, height: 100 };

  const [brakeArray, setBrakeArray] = useState<number[]>(
    Array.from({ length: width }, () => 0)
  );
  const [brakeABSArray, setBrakeABSArray] = useState<boolean[]>(
    Array.from({ length: width }, () => false)
  );
  const [throttleArray, setThrottleArray] = useState<number[]>(
    Array.from({ length: width }, () => 0)
  );

  useEffect(() => {
    // slice first value and append new value
    if (includeThrottle) {  
      setThrottleArray((v) => [...v.slice(1), input.throttle ?? 0]);
    }
    if (includeBrake) {
      setBrakeArray((v) => [...v.slice(1), input.brake ?? 0]);
      if (includeAbs) {
        setBrakeABSArray((v) => [...v.slice(1), input.brakeAbsActive ?? false]);
      }
    }
  }, [input, includeThrottle, includeBrake, includeAbs]);

  useEffect(() => {
    const valueArrayWithColors = [];
    if (includeThrottle) valueArrayWithColors.push({ values: throttleArray, color: THROTTLE_COLOR });
    if (includeBrake) {
      valueArrayWithColors.push({ 
        values: brakeArray, 
        color: BRAKE_COLOR,
        absStates: includeAbs ? brakeABSArray : undefined,
        absColor: includeAbs ? BRAKE_ABS_COLOR : undefined
      });
    }
    drawGraph(svgRef.current, valueArrayWithColors, width, height);
  }, [brakeArray, brakeABSArray, height, throttleArray, width, includeThrottle, includeBrake, includeAbs]);

  return (
    <svg
      ref={svgRef}
      width={'100%'}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    ></svg>
  );
};

function drawGraph(
  svgElement: SVGSVGElement | null,
  valueArrayWithColors: { 
    values: number[]; 
    color: string;
    absStates?: boolean[];
    absColor?: string;
  }[],
  width: number,
  height: number
) {
  if (!svgElement) return;

  const svg = d3.select(svgElement);

  svg.selectAll('*').remove();

  const scaleMargin = 0.05;
  const xScale = d3.scaleLinear().domain([0, width]).range([0, width]);
  const yScale = d3
    .scaleLinear()
    .domain([0 - scaleMargin, 1 + scaleMargin])
    .range([height, 0]);

  drawYAxis(svg, yScale, width);

  valueArrayWithColors.forEach(({ values, color, absStates, absColor }) => {
    if (absStates && absColor) {
      drawABSAwareLine(svg, values, absStates, xScale, yScale, color, absColor);
    } else {
      drawLine(svg, values, xScale, yScale, color);
    }
  });
}

function drawYAxis(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  yScale: d3.ScaleLinear<number, number>,
  width: number
) {
  const yAxis = d3
    .axisLeft(yScale)
    .tickValues(d3.range(0, 1.25, 0.25))
    .tickFormat(() => '');

  svg
    .append('g')
    .call(yAxis)
    .selectAll('line')
    .attr('x2', width)
    .attr('stroke', '#666')
    .attr('stroke-dasharray', '2,2');

  svg.select('.domain').remove();
}

function drawLine(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  valueArray: number[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  color: string
) {
  const line = d3
    .line<number>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(Math.max(0, Math.min(1, d))))
    .curve(d3.curveBasis);

  svg
    .append('g')
    .append('path')
    .datum(valueArray)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 3)
    .attr('d', line);
}

function drawABSAwareLine(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  valueArray: number[],
  absStates: boolean[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  normalColor: string,
  absColor: string
) {
  // Group consecutive points by ABS state
  const segments: { values: { value: number; index: number }[]; isABS: boolean }[] = [];
  let currentSegment: { value: number; index: number }[] = [];
  let currentIsABS = absStates[0];

  for (let i = 0; i < valueArray.length; i++) {
    const isABS = absStates[i];
    
    if (i === 0 || isABS === currentIsABS) {
      currentSegment.push({ value: valueArray[i], index: i });
    } else {
      // ABS state changed, finish current segment
      if (currentSegment.length > 0) {
        segments.push({ values: [...currentSegment], isABS: currentIsABS });
      }
      
      // Start new segment with overlap point for continuity
      currentSegment = [currentSegment[currentSegment.length - 1], { value: valueArray[i], index: i }];
      currentIsABS = isABS;
    }
  }
  
  // Add the final segment
  if (currentSegment.length > 0) {
    segments.push({ values: currentSegment, isABS: currentIsABS });
  }

  // Draw each segment with appropriate color
  segments.forEach(segment => {
    if (segment.values.length > 1) {
      const line = d3
        .line<{ value: number; index: number }>()
        .x((d) => xScale(d.index))
        .y((d) => yScale(Math.max(0, Math.min(1, d.value))))
        .curve(d3.curveBasis);

      svg
        .append('g')
        .append('path')
        .datum(segment.values)
        .attr('fill', 'none')
        .attr('stroke', segment.isABS ? absColor : normalColor)
        .attr('stroke-width', segment.isABS ? 5 : 3)
        .attr('d', line);
    }
  });
}
