import * as d3 from 'd3';
import { useEffect, useRef } from 'react';
import { getColor } from '@irdashies/utils/colors';

const INPUT_CONFIG = [
  { key: 'clutch', color: getColor('blue') },
  { key: 'brake', color: getColor('red') },
  { key: 'throttle', color: getColor('green') }
] as const;

export interface InputBarProps {
  brake?: number;
  throttle?: number;
  clutch?: number;
  settings?: {
    includeClutch: boolean;
    includeBrake: boolean;
    includeThrottle: boolean;
  };
}

export const InputBar = ({
  brake,
  throttle,
  clutch,
  settings = {
    includeClutch: true,
    includeBrake: true,
    includeThrottle: true,
  },
}: InputBarProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Filter and map the values based on settings
    const activeInputs = INPUT_CONFIG.filter(({ key }) => {
      if (key === 'clutch') return settings.includeClutch;
      if (key === 'throttle') return settings.includeThrottle;
      if (key === 'brake') return settings.includeBrake;
      return false;
    }).map(({ key, color }) => ({
      value: key === 'clutch' ? clutch ?? 0 : key === 'brake' ? brake ?? 0 : throttle ?? 0,
      color
    }));

    drawBars(svgRef.current, activeInputs);
  }, [brake, throttle, clutch, settings]);

  return <svg ref={svgRef} width="120"></svg>;
};

function drawBars(svgElement: SVGSVGElement | null, data: { value: number; color: string }[]) {
  if (!svgElement) return;

  const topOffset = 15;
  const width = svgElement.clientWidth;
  const height = svgElement.clientHeight - topOffset;

  const xScale = d3
    .scaleBand()
    .domain(data.map((_, i) => i.toString()))
    .range([0, width])
    .padding(0.25);

  const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();

  svg
    .selectAll('rect')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', (_, i) => xScale(i.toString()) ?? 0)
    .attr('y', (d) => yScale(d.value) + topOffset)
    .attr('width', xScale.bandwidth())
    .attr('height', (d) => height - yScale(d.value))
    .attr('fill', (d) => d.color);

  svg
    .selectAll('text')
    .data(data)
    .enter()
    .append('text')
    .attr('x', (_, i) => (xScale(i.toString()) ?? 0) + xScale.bandwidth() / 2)
    .attr('y', () => 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', 'white')
    .text((d) => (d.value * 100).toFixed(0));
}
