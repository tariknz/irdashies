import fs from 'fs';
import { JSDOM } from 'jsdom';
import { svgPathProperties } from 'svg-path-properties';
import { findDirection, findIntersectionPoint, preCalculatePoints } from './svg-utils';
import { TrackDrawing } from '../src/frontend/components/TrackMap/TrackCanvas';

interface TrackInfo {
  track_id: number;
  track_name: string;
  config_name: string;
}

export const generateTrackJson = () => {
  const order = [
    'background',
    'inactive',
    'active',
    'pitroad',
    'turns',
    'start-finish',
  ];
  const tracks = fs.readdirSync(`./asset-data`);
  const trackInfoString = fs.readFileSync(
    './asset-data/track-info.json',
    'utf8'
  );
  const trackInfo: TrackInfo[] = JSON.parse(trackInfoString);

  const json = tracks.reduce(
    (acc, trackId) => {
      // check if its a folder
      if (!fs.lstatSync(`./asset-data/${trackId}`).isDirectory()) {
        return acc;
      }

      return {
        ...acc,
        [parseInt(trackId)]: generateJson(trackId),
      };
    },
    {} as Record<number, TrackDrawing | undefined>
  );

  fs.writeFileSync(
    `./src/frontend/components/TrackMap/tracks/tracks.json`,
    JSON.stringify(json, undefined, 2),
    'utf8'
  );

  function generateJson(trackId: string) {
    const track = trackInfo.find((t) => t.track_id === +trackId);
    if (!track) {
      console.error(`No track info found for ${trackId}`);
      return;
    }
    const json = fs
      .readdirSync(`./asset-data/${trackId}`)
      .sort(
        (a, b) =>
          order.indexOf(a.replace('.svg', '')) -
          order.indexOf(b.replace('.svg', ''))
      )
      .filter((file) => file.endsWith('.svg'))
      .map((file) => {
        const svgContent = fs.readFileSync(
          `./asset-data/${trackId}/${file}`,
          'utf8'
        );
        return { file, trackId: parseInt(trackId), svgContent };
      })
      .reduce((acc, { file, trackId, svgContent }) => {
        const id = `${file.replace('.svg', '')}`;
        const svg = getSvgDom(svgContent);
        // snake case to camel case
        const prop = id.replace(/([-_][a-z])/g, (group) =>
          group.toUpperCase().replace('-', '').replace('_', '')
        );

        if (prop === 'active') {
          const path = svg.querySelector('path') as SVGPathElement | null;
          const pathData = path?.getAttribute('d')?.replace(/\s/g, ''); // remove whitespace
          if (!pathData) {
            return acc;
          }
          // split on Z
          const firstZ = pathData.toLocaleLowerCase().indexOf('z') + 1;
          const inside = pathData.slice(0, firstZ);
          const outside = pathData.slice(firstZ);
          
          // Pre calculate points for the inside path to be able to find the position 
          // based on the percentage of the track completed
          const trackPathPoints = preCalculatePoints(inside);
          
          // Calculate the total track length using svg-path-properties
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
          const paths = svg.querySelectorAll('path');
          const line = paths?.[0]?.getAttribute('d')?.replace(/\s/g, '');
          const arrow = paths?.[1]?.getAttribute('d')?.replace(/\s/g, '');
          let flipLineArrow = false;
          let intersection = findIntersectionPoint(
            acc['active'].inside,
            line || ''
          );

          if (!intersection) {
            flipLineArrow = true;
            intersection = findIntersectionPoint(
              acc['active'].inside,
              arrow || ''
            );
          }
          acc[prop] = {
            line: flipLineArrow ? arrow : line,
            arrow: flipLineArrow ? line : arrow,
            point: intersection,
            direction: findDirection(trackId),
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

        // TODO:
        // Unused currently, inactive, pit road, background

        return acc;
      }, {} as TrackDrawing);

    return json;
  }
};

const getSvgDom = (svgContent: string) => {
  const dom = new JSDOM(svgContent);
  const root = dom.window.document.documentElement;
  const svg = root.querySelector('svg') as SVGSVGElement;
  return svg;
};
