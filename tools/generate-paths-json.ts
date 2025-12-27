import fs from 'fs';
import { JSDOM } from 'jsdom';
import { svgPathProperties } from 'svg-path-properties';
import { findDirection, findIntersectionPoint, preCalculatePoints, extractStartFinishData } from './svg-utils';
import { TrackDrawing } from '../src/frontend/components/TrackMap/TrackCanvas';

interface TrackInfo {
  track_id: number;
  track_name: string;
  config_name: string;
}

export const generateTrackJsonForTrack = (trackId: number | string): TrackDrawing | undefined => {
  const order = [
    'background',
    'inactive',
    'active',
    'pitroad',
    'turns',
    'start-finish',
  ];
  
  const trackIdStr = String(trackId);
  const trackPath = `./asset-data/${trackIdStr}`;
  
  if (!fs.existsSync(trackPath) || !fs.lstatSync(trackPath).isDirectory()) {
    console.error(`Track directory not found for trackId: ${trackId}`);
    return undefined;
  }

  const trackInfoString = fs.readFileSync(
    './asset-data/track-info.json',
    'utf8'
  );
  const trackInfo: TrackInfo[] = JSON.parse(trackInfoString);
  
  const track = trackInfo.find((t) => t.track_id === +trackIdStr);
  if (!track) {
    console.error(`No track info found for ${trackId}`);
    return undefined;
  }

  const json = fs
    .readdirSync(trackPath)
    .sort(
      (a, b) =>
        order.indexOf(a.replace('.svg', '')) -
        order.indexOf(b.replace('.svg', ''))
    )
    .filter((file) => file.endsWith('.svg'))
    .map((file) => {
      const overridePath = `./tools/tracks/overrides/${trackIdStr}/${file}`;
      const svgPath = fs.existsSync(overridePath)
        ? overridePath
        : `${trackPath}/${file}`;
      const svgContent = fs.readFileSync(svgPath, 'utf8');
      return { file, svgContent };
    })
    .reduce((acc, { file, svgContent }) => {
      const id = `${file.replace('.svg', '')}`;
      const svg = getSvgDom(svgContent);
      const prop = id.replace(/([-_][a-z])/g, (group) =>
        group.toUpperCase().replace('-', '').replace('_', '')
      );

      if (prop === 'active') {
        const path = svg.querySelector('path') as SVGPathElement | null;
        const rawPathData = path?.getAttribute('d');
        if (!rawPathData) {
          return acc;
        }
        // Normalize path data: replace spaces with commas for proper number separation
        // Handle edge cases: remove commas after command letters, clean up multiple commas
        const pathData = rawPathData
          .trim()
          .replace(/\s+/g, ' ') // First normalize whitespace
          .replace(/\s/g, ',') // Replace spaces with commas
          .replace(/,([MmLlHhVvCcSsQqTtAaZz])/g, '$1') // Remove comma before command
          .replace(/([MmLlHhVvCcSsQqTtAaZz]),/g, '$1') // Remove comma after command
          .replace(/,,+/g, ',') // Replace multiple commas with single comma
          .replace(/^,/, '') // Remove leading comma
          .replace(/,$/, ''); // Remove trailing comma
        const firstZIndex = pathData.toLocaleLowerCase().indexOf('z');
        const firstZ = firstZIndex === -1 ? pathData.length : firstZIndex + 1;
        const inside = pathData.slice(0, firstZ);
        const outside = pathData.slice(firstZ);
        
        const trackPathPoints = preCalculatePoints(inside);
        const pathProps = new svgPathProperties(inside);
        const totalLength = pathProps.getTotalLength();

        
        acc[prop] = {
          inside,
          outside,
          trackPathPoints,
          totalLength,
        };
      }

      if (prop === 'startFinish') {
        const startFinishData = extractStartFinishData(svg);
        if (!startFinishData) {
          return acc;
        }

        const { line, arrow } = startFinishData;
        let flipLineArrow = false;
        let intersection = findIntersectionPoint(
          acc['active'].inside,
          line
        );

        if (!intersection) {
          flipLineArrow = true;
          intersection = findIntersectionPoint(
            acc['active'].inside,
            arrow
          );
        }
        acc[prop] = {
          line: flipLineArrow ? arrow : line,
          arrow: flipLineArrow ? line : arrow,
          point: intersection,
          direction: findDirection(parseInt(trackIdStr)),
        };
      }

      if (prop === 'turns') {
        const texts = svg.querySelectorAll('text');
        const turns = Array.from(texts).map((text) => {
          const transform = text.getAttribute('transform');
          const groups = transform?.match(
            /(?:matrix\(1 0 0 1 |translate\()([\d.]+) ([\d.]+)/
          );
          const x = groups?.[1] ? parseFloat(groups[1]) : 0;
          const y = groups?.[2] ? parseFloat(groups[2]) : 0;
          const content = text.textContent ?? undefined;
          return { x, y, content };
        });
        acc[prop] = turns;
      }

      return acc;
    }, {} as TrackDrawing);

  return json;
};

export const generateTrackJson = () => {
  const tracks = fs.readdirSync(`./asset-data`);

  const json = tracks.reduce(
    (acc, trackId) => {
      // check if its a folder
      if (!fs.lstatSync(`./asset-data/${trackId}`).isDirectory()) {
        return acc;
      }

      return {
        ...acc,
        [parseInt(trackId)]: generateTrackJsonForTrack(trackId),
      };
    },
    {} as Record<number, TrackDrawing | undefined>
  );

  fs.writeFileSync(
    `./src/frontend/components/TrackMap/tracks/tracks.json`,
    JSON.stringify(json, undefined, 2),
    'utf8'
  );
};

const getSvgDom = (svgContent: string) => {
  const dom = new JSDOM(svgContent);
  const root = dom.window.document.documentElement;
  const svg = root.querySelector('svg') as SVGSVGElement;
  return svg;
};
