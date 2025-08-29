import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { getColor } from '@irdashies/utils/colors';

const BRAKE_COLOR = getColor('red');
const THROTTLE_COLOR = getColor('green');

export interface InputTraceProps {
  input: {
    brake?: number;
    throttle?: number;
  };
  settings?: {
    includeThrottle?: boolean;
    includeBrake?: boolean;
    timeWindowSeconds?: number;
  };
}

export const InputTrace = ({
  input,
  settings = { includeThrottle: true, includeBrake: true, timeWindowSeconds: 10 },
}: InputTraceProps) => {
  const { includeThrottle, includeBrake, timeWindowSeconds = 10 } = settings;
  const svgRef = useRef<SVGSVGElement>(null);
  const { width, height } = { width: 400, height: 100 };

  // Calculate buffer size based on time window
  // Assume ~60 Hz updates, but cap the visual resolution to width pixels for performance
  const samplesPerSecond = 60;
  const totalSamples = Math.floor(timeWindowSeconds * samplesPerSecond);
  const bufferSize = Math.min(totalSamples, width * 2); // Allow up to 2x width for smoother curves

  const [brakeArray, setBrakeArray] = useState<number[]>(
    Array.from({ length: bufferSize }, () => 0)
  );
  const [throttleArray, setThrottleArray] = useState<number[]>(
    Array.from({ length: bufferSize }, () => 0)
  );

  // Reset arrays when buffer size changes
  useEffect(() => {
    setBrakeArray(Array.from({ length: bufferSize }, () => 0));
    setThrottleArray(Array.from({ length: bufferSize }, () => 0));
  }, [bufferSize]);

  useEffect(() => {
    // slice first value and append new value
    if (includeThrottle) {  
      setThrottleArray((v) => {
        if (v.length !== bufferSize) return Array.from({ length: bufferSize }, () => 0);
        return [...v.slice(1), input.throttle ?? 0];
      });
    }
    if (includeBrake) {
      setBrakeArray((v) => {
        if (v.length !== bufferSize) return Array.from({ length: bufferSize }, () => 0);
        return [...v.slice(1), input.brake ?? 0];
      });
    }
  }, [input, includeThrottle, includeBrake, bufferSize]);

  useEffect(() => {
    const valueArrayWithColors = [];
    if (includeThrottle) valueArrayWithColors.push({ values: throttleArray, color: THROTTLE_COLOR });
    if (includeBrake) valueArrayWithColors.push({ values: brakeArray, color: BRAKE_COLOR });
    drawGraph(svgRef.current, valueArrayWithColors, width, height, bufferSize);
  }, [brakeArray, height, throttleArray, width, includeThrottle, includeBrake, bufferSize]);

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
  valueArrayWithColors: { values: number[]; color: string }[],
  width: number,
  height: number,
  bufferSize: number
) {
  if (!svgElement || valueArrayWithColors.length === 0) return;

  const svg = d3.select(svgElement);

  svg.selectAll('*').remove();

  const scaleMargin = 0.05;
  // Map data points to the visual width
  const xScale = d3.scaleLinear().domain([0, bufferSize - 1]).range([0, width]);
  const yScale = d3
    .scaleLinear()
    .domain([0 - scaleMargin, 1 + scaleMargin])
    .range([height, 0]);

  drawYAxis(svg, yScale, width);

  valueArrayWithColors.forEach(({ values, color }) => {
    drawLine(svg, values, xScale, yScale, color);
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
