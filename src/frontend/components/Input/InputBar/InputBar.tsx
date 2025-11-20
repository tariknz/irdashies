import * as d3 from 'd3';
import { useEffect, useRef, useMemo } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const { includeAbs = true, includeClutch, includeBrake, includeThrottle } = settings;

  // Calculate active inputs and their values
  const activeInputs = useMemo(() => {
    return INPUT_CONFIG.filter(({ key }) => {
      if (key === 'clutch') return includeClutch;
      if (key === 'throttle') return includeThrottle;
      if (key === 'brake') return includeBrake;
      return false;
    }).map(({ key, color }) => ({
      key,
      value: key === 'clutch' ? clutch ?? 0 : key === 'brake' ? brake ?? 0 : throttle ?? 0,
      color: key === 'brake' && brakeAbsActive && includeAbs ? getColor('yellow', 500) : color
    }));
  }, [brake, throttle, clutch, brakeAbsActive, includeClutch, includeBrake, includeThrottle, includeAbs]);

  // Calculate bar layout
  const barWidth = 40;
  const gap = 8;
  const totalWidth = activeInputs.length * barWidth + (activeInputs.length - 1) * gap;

  useEffect(() => {
    drawBars(svgRef.current, activeInputs, brakeAbsActive, includeAbs);
  }, [activeInputs, brakeAbsActive, includeAbs]);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full items-center">
      {/* Top row: Values as text */}
      <div className="flex justify-center gap-2" style={{ width: `${totalWidth}px`, gap: `${gap}px` }}>
        {activeInputs.map(({ key, value }) => (
          <div key={key} className="text-white text-center text-2xl font-bold" style={{ width: `${barWidth}px` }}>
            {(value * 100).toFixed(0)}
          </div>
        ))}
      </div>
      
      {/* Bottom row: SVG bars */}
      <svg 
        ref={svgRef} 
        className="flex-1"
        style={{ width: `${totalWidth}px` }}
        preserveAspectRatio="none"
      />
    </div>
  );
};

function drawBars(
  svgElement: SVGSVGElement | null, 
  data: { key: string; value: number; color: string }[], 
  brakeAbsActive?: boolean, 
  includeAbs?: boolean
) {
  if (!svgElement) return;

  const height = svgElement.clientHeight;

  // Calculate bar dimensions
  const barWidth = 40; // Fixed width for each bar
  const gap = 8; // Small gap between bars

  const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();

  // Draw bars (no centering needed since SVG width matches total width)
  svg
    .selectAll('rect')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', (_, i) => i * (barWidth + gap))
    .attr('y', (d) => yScale(d.value))
    .attr('width', barWidth)
    .attr('height', (d) => height - yScale(d.value))
    .attr('fill', (d) => d.color);

  // Overlay ABS label if needed
  if (brakeAbsActive && includeAbs) {
    const brakeIndex = data.findIndex((d) => d.key === 'brake');
    if (brakeIndex !== -1) {
      svg
        .append('text')
        .attr('x', brakeIndex * (barWidth + gap) + barWidth / 2)
        .attr('y', height - 4) // 4px above the bottom of the bar
        .attr('text-anchor', 'middle')
        .attr('font-size', '10rem')
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .attr('pointer-events', 'none')
        .attr('style', 'text-shadow: 0 1px 4px #000;')
        .text('ABS');
    }
  }
}
