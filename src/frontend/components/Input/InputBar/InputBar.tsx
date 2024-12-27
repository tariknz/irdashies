import * as d3 from 'd3';
import { useEffect, useRef } from 'react';
import tailwindColors from 'tailwindcss/colors';

const COLORS = [
  tailwindColors.blue['500'],
  tailwindColors.red['500'],
  tailwindColors.green['500'],
];

export interface InputTraceProps {
  brake?: number;
  throttle?: number;
  clutch?: number;
}

export const InputBar = ({ brake, throttle, clutch }: InputTraceProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    drawBars(svgRef.current, [clutch ?? 0, brake ?? 0, throttle ?? 0]);
  }, [brake, throttle, clutch]);

  return <svg ref={svgRef} width="120"></svg>;
};

function drawBars(svgElement: SVGSVGElement | null, values: number[]) {
  if (!svgElement) return;

  const topOffset = 15;
  const width = svgElement.clientWidth;
  const height = svgElement.clientHeight - topOffset;
  const data = values.map((value, i) => ({
    value,
    color: COLORS[i % COLORS.length],
  }));

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
