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
  brakeAbsActive?: boolean;
  settings?: {
    includeClutch: boolean;
    includeBrake: boolean;
    includeThrottle: boolean;
    includeAbs: boolean;
  };
}

export const InputBar = ({
  brake,
  throttle,
  clutch,
  brakeAbsActive,
  settings = {
    includeClutch: true,
    includeBrake: true,
    includeThrottle: true,
    includeAbs: true,
  },
}: InputBarProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { includeAbs = true, includeClutch, includeBrake, includeThrottle } = settings;

  useEffect(() => {
    // Filter and map the values based on settings
    const activeInputs = INPUT_CONFIG.filter(({ key }) => {
      if (key === 'clutch') return includeClutch;
      if (key === 'throttle') return includeThrottle;
      if (key === 'brake') return includeBrake;
      return false;
    }).map(({ key, color }) => ({
      value: key === 'clutch' ? clutch ?? 0 : key === 'brake' ? brake ?? 0 : throttle ?? 0,
      color: key === 'brake' && brakeAbsActive && includeAbs ? getColor('yellow', 500) : color
    }));

    drawBars(svgRef.current, activeInputs, brakeAbsActive, includeAbs);
  }, [brake, throttle, clutch, brakeAbsActive, includeClutch, includeBrake, includeThrottle, includeAbs]);

  return <svg ref={svgRef} width="120" height="100%"></svg>;
};

function drawBars(svgElement: SVGSVGElement | null, data: { value: number; color: string }[], brakeAbsActive?: boolean, includeAbs?: boolean) {
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
    .selectAll('text.value')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'value')
    .attr('x', (_, i) => (xScale(i.toString()) ?? 0) + xScale.bandwidth() / 2)
    .attr('y', () => 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', 'white')
    .text((d) => (d.value * 100).toFixed(0));

  // Overlay ABS label if needed
  if (brakeAbsActive && includeAbs) {
    // Find the brake bar index
    const brakeIndex = data.findIndex((d, i) => INPUT_CONFIG[i].key === 'brake');
    if (brakeIndex !== -1) {
      svg
        .append('text')
        .attr('x', (xScale(brakeIndex.toString()) ?? 0) + xScale.bandwidth() / 2)
        .attr('y', height + topOffset - 4) // 4px above the bottom of the bar
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .attr('pointer-events', 'none')
        .attr('style', 'text-shadow: 0 1px 4px #000;')
        .text('ABS');
    }
  }
}
