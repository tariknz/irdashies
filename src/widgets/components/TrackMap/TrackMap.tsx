import { useEffect, useRef } from 'react';

export const TrackMap = () => {
  const trackPathRef = useRef<SVGPathElement | null>(null);
  const indicatorRef = useRef<SVGCircleElement | null>(null);
  const startFinishRef = useRef<SVGGElement | null>(null);
  const insidePathRef = useRef<SVGPathElement | null>(null);
  const turnsRef = useRef<SVGGElement | null>(null);

  // Function to parse the `d` attribute into path commands
  const parsePathData = (d: string): string[] => {
    const commands = d.match(/([MLCZHVTA][^MLCZHVTA]*)/gi); // Matches path commands
    return commands ? commands.map((cmd) => cmd.trim()) : [];
  };

  // Function to split the path into inside and outside parts
  const splitPathData = (
    commands: string[]
  ): { inside: string; outside: string } => {
    const halfwayIndex = Math.ceil(commands.length / 2);
    const insideCommands = commands.slice(0, halfwayIndex).join(' ');
    const outsideCommands = commands.slice(halfwayIndex).join(' ');
    return { inside: insideCommands, outside: outsideCommands };
  };

  useEffect(() => {
    const combinedPath = trackPathRef.current;

    if (combinedPath) {
      const pathData = combinedPath.getAttribute('d');

      if (pathData) {
        const commands = parsePathData(pathData);
        const { inside } = splitPathData(commands);

        if (insidePathRef.current)
          insidePathRef.current.setAttribute('d', inside);
      }
    }
  }, []);

  useEffect(() => {
    const trackPath = insidePathRef.current as SVGPathElement | null;
    const indicator = indicatorRef.current as SVGCircleElement | null;
    const startFinishPath = startFinishRef.current as SVGPathElement | null;

    const totalLength = trackPath?.getTotalLength() || 0;

    // Function to find the intersection of two lines
    function lineIntersection(
      p1: DOMPoint,
      p2: DOMPoint,
      p3: DOMPoint,
      p4: DOMPoint
    ) {
      const denominator =
        (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
      if (denominator === 0) return null;

      const ua =
        ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) /
        denominator;
      const ub =
        ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) /
        denominator;

      if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;

      const x = p1.x + ua * (p2.x - p1.x);
      const y = p1.y + ua * (p2.y - p1.y);

      return { x, y };
    }

    // Find the intersection point using a more efficient approach
    function findIntersectionPoint() {
      const path1 = trackPath;
      const path2 = startFinishPath?.querySelector('path');

      if (path1 && path2) {
        const path1Length = path1.getTotalLength();
        const path2Length = path2.getTotalLength();
        const step = 100; // Increase step size to reduce the number of points checked

        for (let i = 0; i < path1Length; i += step) {
          const p1 = path1.getPointAtLength(i);
          const p2 = path1.getPointAtLength(i + step);

          for (let j = 0; j < path2Length; j += step) {
            const p3 = path2.getPointAtLength(j);
            const p4 = path2.getPointAtLength(j + step);

            const intersection = lineIntersection(p1, p2, p3, p4);

            if (intersection) {
              return {
                x: intersection.x,
                y: intersection.y,
                length: i,
              };
            }
          }
        }
      }

      return null;
    }

    // Find the direction of the track at the intersection point
    function findDirection() {
      // get text position of turn 1
      const turn1 = turnsRef.current?.querySelector('text') as SVGTextElement;
      const turn1Position = turn1?.getBoundingClientRect();

      // get text position of turn 2
      const turn2 = turnsRef.current?.querySelector(
        'text:nth-child(2)'
      ) as SVGTextElement;
      const turn2Position = turn2?.getBoundingClientRect();

      if (turn1Position && turn2Position) {
        const direction = {
          x: turn2Position.x - turn1Position.x,
          y: turn2Position.y - turn1Position.y,
        };

        return direction.x > 0 ? 'clockwise' : 'anticlockwise';
      }

      return 'clockwise';
    }

    // Get the intersection point and length
    const direction = findDirection();
    const intersection = findIntersectionPoint() || { x: 0, y: 0, length: 0 };

    function updateCarPosition(percent: number) {
      const adjustedLength = (totalLength * (percent / 100)) % totalLength;
      const length =
        direction === 'anticlockwise'
          ? (intersection.length + adjustedLength) % totalLength
          : (intersection.length - adjustedLength + totalLength) % totalLength;
      const point = trackPath?.getPointAtLength(length);

      if (indicator && point) {
        indicator.setAttribute('cx', `${point.x}`);
        indicator.setAttribute('cy', `${point.y}`);
      }
    }

    updateCarPosition(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress = progress + 0.5;
      if (progress > 100) {
        progress = 0;
      }
      updateCarPosition(progress);
    }, 30);

    return () => clearInterval(interval);
  }, []);

  return (
    <svg
      version="1.1"
      width={500}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1920 1080"
      id="track-svg"
    >
      <path
        ref={trackPathRef}
        id="track-path"
        className="fill-white"
        d="M1712.7,506.9c-2.3-26.3-7.4-66.6-12.4-105.6c-3.9-31.1-7.6-60.4-9.8-81.4c-4.3-41.6-30.5-46.7-41.7-48.9  c-9-1.7-19.3-4.3-28.4-6.6c-3.7-0.9-7.2-1.8-10.3-2.6c-16-3.8-26.1-8.2-30-13.1c-2.6-3.2-2.5-6.7-2.1-13.1l0.1-0.9  c2.1-31.4-27.5-47.3-46.7-49.9c-11.3-1.6-32.5-6-46.5-9c-3-0.6-5.7-1.2-8-1.7c-15.9-3.3-37.1-7.8-60.1-12.7  c-47.3-10-100.8-21.3-133.2-27.9c-37.9-7.8-116.2-23.5-156.4-31.4c-18.7-3.7-75.3-14.4-75.9-14.6l-0.7-0.1  c-31.3-3.1-56.2-0.9-85,1.8c-3.9,0.4-8,0.7-12.1,1.1c-5.1,0.5-22.3,2-30.8,2.8c-19.9,1.9-52.8,4.4-77,6.1  c-26.5,1.9-31.8,0.3-40.3-3.2c-3.9-1.6-10.1-3.8-16-6c-4-1.5-7.8-2.8-10.5-3.9c-45.4-17.5-76.1,1.2-95.3,16.7  c-10.7,8.7-16.4,10.4-21.8,11.6c-11.6,2.4-35.2,7.5-47.6,10.3c-7.1,1.6-15.6,3.5-25,5.6c-39.9,8.9-94.6,21.1-124.7,29.2  c-41.1,11.1-71.8,29.5-99,47.7c-2.7,1.8-6.1,4-9.8,6.5c-13,8.6-29.2,19.3-38.2,26.3c-2.4,1.9-6.1,4.4-9.9,7  c-11.7,8-26.2,17.9-32.2,27.4c-5.3,8.4-4,14.3-1.9,17.7c4.7,8,16,7.9,18.3,7.7c59.5-3.2,179.9-8.8,240.2-11  c14.4-0.5,33.2-1.6,53-2.7c26.2-1.5,53.3-3,70.9-3.3c2.6-0.1,3.9,0.3,4.3,0.5c0.2,1.4-0.9,4.7-2.3,7.1c-3.1,3.7-8.1,10.1-9.2,14.4  c-3.2,11.9,0.8,19.8,4.8,24.3c4.2,4.8,9.6,7.6,13.9,9.4c18.5,8,43.3,18.5,57.8,23.9c12.1,4.6,36.3,12.7,49.8,16.8  c12.9,3.9,40.6,9.4,52,11.4c26,4.6,56.8,8.5,84.1,11.9c24.4,3.1,47.4,5.9,63.6,8.9c16.8,3.1,30.9,11.3,43,25.3  c2,2.3,4.7,5.4,7.6,8.6c3.5,4,7.1,8.1,9.5,10.8c2.1,2.5,4.6,5.3,7.2,8.4c15.1,17.5,38,44.1,49.6,59.1c33.5,43.3,31.9,82,30.7,110.2  l0,0.9c-0.3,6.9-0.8,15.7-1.2,25c-1.5,27.9-3.3,62.6-2.7,82.8c1.2,41.3,7.4,76.3,19.5,110c16.4,45.5,26.2,61.4,36.7,78.3l2.1,3.4  c12.1,19.7,32.5,43.4,44.5,54.1c20.2,18.1,40.2,23.1,56.3,23.1c12.4,0,22.4-3,28.3-5.3c17.2-6.7,59.3-23.9,77.1-38.6  c29.1-24,16.7-47.8,10.7-59.3c-12.1-23.5-37-71-52.2-98.6c-21.8-39.7,18-69.2,19.2-70c20-12.1,31.3-26.4,33.7-42.4  c2.4-15.8-4.1-32.5-19.2-49.5c-8.2-9.2-21-23.1-33.4-36.5c-11.4-12.3-23.1-25.1-30.6-33.5c-5.5-6.2-13-14.4-20.9-23  c-16.5-18-37-40.3-49.4-55.6c-36-44.6-27.3-86.9-16.6-104.9c19.1-31.9,26.6-40.3,37.3-51.2c17-17.4,55.8-10.3,71.8-6.4  c7.6,1.8,22.5,7,30.7,10.3c30.4,12.4,83,27.8,110.9,35.1c45.8,12,83.8,17.2,117.4,21.8l7.1,1c23.6,3.2,27.2,15.1,27.7,27.5  c0.6,16.9,3.7,65.6,3.9,69c0.6,17.9,5.8,31,15.3,39.1c10.2,8.6,22.6,9.1,31.2,8C1703.9,545.4,1714.2,524.7,1712.7,506.9z   M1675.5,534c-5.6,0.7-13.5,0.5-19.6-4.6c-6.1-5.2-9.5-14.7-10-28.3l0-0.2c0-0.5-3.4-51.7-3.9-68.6c-0.2-6.4-1.2-15.9-7.2-24.4  c-6.7-9.5-17.9-15.3-33.4-17.5l-7.2-1c-33.1-4.5-70.7-9.7-115.6-21.4c-27.5-7.2-79.3-22.3-109.1-34.5c-8.7-3.5-24.4-8.9-32.8-11  c-22.9-5.6-64.4-11.6-86,10.5c-12.6,12.9-20.5,22.4-39.5,54c-8.5,14.2-12.6,33.2-11.4,52.1c1.6,24.1,11.7,48.2,29.2,69.9  c12.7,15.7,32.5,37.3,50,56.3c7.9,8.6,15.3,16.7,20.7,22.8c7.6,8.5,18.8,20.7,30.8,33.7c12.3,13.4,25.1,27.2,33.2,36.3  c12,13.6,17.3,26.2,15.6,37.4c-1.7,11.4-10.7,22.1-26.8,31.8c-2.6,1.6-15,11.3-23.7,26.4c-11.9,20.7-12.2,42.7-0.7,63.6  c15.1,27.5,39.9,74.9,52,98.3c5.7,10.9,12.8,24.5-7,40.8l0,0c-16.6,13.7-60,31.1-72.9,36.1c-13.6,5.3-40.8,10.4-69.2-15  c-11.2-10.1-30.7-32.9-41.7-50.8l-2.1-3.5c-10.5-16.9-19.5-31.5-35.3-75.5c-11.6-32.2-17.5-65.7-18.7-105.4  c-0.6-19.6,1.2-54,2.7-81.6c0.5-9.4,1-18.2,1.2-25.2l0-0.9c1.3-30.5,3.1-72.4-33.8-120c-11.9-15.3-34.9-42-50.1-59.7  c-2.7-3.1-5.1-5.9-7.2-8.4c-2.4-2.8-6.1-7-9.6-11c-2.8-3.2-5.5-6.3-7.5-8.5c-14.4-16.6-31.3-26.5-51.6-30.2c-16.6-3-39.8-6-64.4-9  c-28.4-3.6-57.7-7.2-83.3-11.8c-14.1-2.5-39-7.6-50.3-11c-13.2-4-37-12-48.9-16.5c-14.2-5.3-38.8-15.7-57.1-23.6  c-9.6-4.1-12.3-8.3-10.2-15.9c0.6-1.4,3.7-5.7,6.6-9.2l0.3-0.4l0.3-0.5c1.4-2.2,8.1-13.9,2.9-23c-2.1-3.8-6.9-8.2-17.7-8  c-17.8,0.4-45.1,1.9-71.4,3.3c-19.8,1.1-38.4,2.1-52.7,2.7c-60.3,2.2-180.9,7.9-240.4,11c-1.4,0.1-2.9-0.1-3.9-0.4  c0.2-0.5,0.5-1.2,1.1-2.1c4.3-6.9,18-16.2,28-23c4.2-2.9,7.8-5.3,10.6-7.5c8.6-6.6,25.2-17.6,37.3-25.6c3.7-2.5,7.1-4.7,9.8-6.5  c24.3-16.3,53.6-34.6,94.5-45.7c29.8-8,84.3-20.2,124.1-29c9.4-2.1,17.9-4,25-5.6c12.3-2.8,35.8-7.8,47.4-10.2  c8.3-1.7,16.2-4.9,28.2-14.6c18.7-15.2,42.9-28.8,80.4-14.4c2.8,1.1,6.6,2.5,10.7,4c5.5,2,11.8,4.3,15.4,5.8  c12.1,4.9,20.1,6.2,47,4.3c24.3-1.7,57.4-4.2,77.4-6.2c8.4-0.8,25.6-2.3,30.7-2.8c4.1-0.4,8.2-0.7,12.2-1.1  c27.9-2.6,52.1-4.8,81.8-1.8c4.7,0.9,57.5,11,75.5,14.5c40.2,7.9,118.4,23.6,156.3,31.3c32.4,6.6,85.9,17.9,133.1,27.9  c23,4.9,44.2,9.3,60.1,12.7c2.3,0.5,5,1.1,8,1.7c15.1,3.2,35.7,7.6,47.5,9.2c9.3,1.3,35.4,10.3,33.8,34.1l-0.1,0.9  c-1.2,17.4,1.2,31.6,43.6,41.8c3,0.7,6.5,1.6,10.1,2.5c9.3,2.3,19.7,5,29.2,6.8c10.5,2,26.5,5.1,29.6,35.7  c2.2,21.1,5.9,50.5,9.8,81.7c4.9,38.9,10,79,12.3,105C1697.9,510.5,1699,530.9,1675.5,534z"
      />

      {/* Inside Path - this is set manually */}
      <path
        ref={insidePathRef}
        d=""
        fill="none"
        stroke="blue"
        strokeWidth="2"
      />

      <circle
        ref={indicatorRef}
        id="car-indicator"
        className="fill-red-500 "
        r="30"
      />

      <g ref={startFinishRef} className="fill-blue-500">
        <path
          className="st0"
          d="M540.4,317.3c0.1,0,0.2,0,0.3,0c2.8-0.2,4.9-2.5,4.7-5.3l-3.5-60.9c-0.2-2.8-2.5-4.9-5.3-4.7   c-2.8,0.2-4.9,2.5-4.7,5.3l3.5,60.9C535.6,315.3,537.8,317.3,540.4,317.3z"
        />
        <path
          className="st0"
          d="M604.4,362.7l-61.6,2.3l12.4-32.6l-86.3,40.3l89.1,33.7l-14.8-31.5l61.6-2.3v0c2.8-0.1,4.9-2.4,4.8-5.2   S607.2,362.6,604.4,362.7z"
        />
      </g>
      <g id="turns" ref={turnsRef} className="fill-white">
        <text transform="matrix(1 0 0 1 334.71 274.15)" className="st0 st1 st2">
          1
        </text>
        <text transform="matrix(1 0 0 1 645.85 97.16)" className="st0 st1 st2">
          2
        </text>
        <text transform="matrix(1 0 0 1 728.2 136.13)" className="st0 st1 st2">
          3
        </text>
        <text transform="matrix(1 0 0 1 814.87 86)" className="st0 st1 st2">
          4
        </text>
        <text
          transform="matrix(1 0 0 1 1521.8199 242.49)"
          className="st0 st1 st2"
        >
          5
        </text>
        <text
          transform="matrix(1 0 0 1 1590.1801 244.72)"
          className="st0 st1 st2"
        >
          6
        </text>
        <text
          transform="matrix(1 0 0 1 1641.87 333.57)"
          className="st0 st1 st2"
        >
          7
        </text>
        <text
          transform="matrix(1 0 0 1 1661.98 521.33)"
          className="st0 st1 st2"
        >
          8
        </text>
        <text
          transform="matrix(1 0 0 1 1591.48 447.71)"
          className="st0 st1 st2"
        >
          9
        </text>
        <text
          transform="matrix(1 0 0 1 1269.84 377.94)"
          className="st0 st1 st2"
        >
          10
        </text>
        <text
          transform="matrix(1 0 0 1 1225.86 451.68)"
          className="st0 st1 st2 st3"
        >
          11
        </text>
        <text
          transform="matrix(1 0 0 1 1324.41 700.33)"
          className="st0 st1 st2"
        >
          12
        </text>
        <text
          transform="matrix(1 0 0 1 1348.92 792.04)"
          className="st0 st1 st2"
        >
          13
        </text>
        <text
          transform="matrix(1 0 0 1 1332.73 944.05)"
          className="st0 st1 st2"
        >
          14
        </text>
        <text
          transform="matrix(1 0 0 1 1246.75 980.13)"
          className="st0 st1 st2"
        >
          15
        </text>
        <text
          transform="matrix(1 0 0 1 1058.75 586.67)"
          className="st0 st1 st2"
        >
          16
        </text>
        <text transform="matrix(1 0 0 1 952.92 467.6)" className="st0 st1 st2">
          17
        </text>
        <text transform="matrix(1 0 0 1 678.95 318.38)" className="st0 st1 st2">
          18
        </text>
        <text transform="matrix(1 0 0 1 594.42 321.91)" className="st0 st1 st2">
          19
        </text>
        <text transform="matrix(1 0 0 1 564.48 55.91)" className="st0 st1 st2">
          Eau Rouge
        </text>
        <text transform="matrix(1 0 0 1 762.95 155.35)" className="st0 st1 st2">
          Raidillon
        </text>
        <text
          transform="matrix(1 0 0 1 1236.61 109.02)"
          className="st0 st1 st2"
        >
          Kemmel Straight
        </text>
        <text
          transform="matrix(1 0 0 1 1586.39 203.57)"
          className="st0 st1 st2"
        >
          Les Combes
        </text>
        <text
          transform="matrix(1 0 0 1 1450.42 306.57)"
          className="st0 st1 st2"
        >
          Malmedy
        </text>
        <text
          transform="matrix(1 0 0 1 1502.96 365.48)"
          className="st0 st1 st2"
        >
          No Name
        </text>
        <text
          transform="matrix(1 0 0 1 1661.41 594.35)"
          className="st0 st1 st2"
        >
          Rivage
        </text>
        <text
          transform="matrix(1 0 0 1 1246.9301 412.35)"
          className="st0 st1 st2"
        >
          Pouhon
        </text>
        <text
          transform="matrix(1 0 0 1 1205.62 740.02)"
          className="st0 st1 st2"
        >
          Fagnes
        </text>
        <text
          transform="matrix(1 0 0 1 1144.39 1062.46)"
          className="st0 st1 st2"
        >
          Curve Paul Frere
        </text>
        <text transform="matrix(1 0 0 1 913.49 371.68)" className="st0 st1 st2">
          Blanchimont
        </text>
        <text transform="matrix(1 0 0 1 691.51 284.68)" className="st0 st1 st2">
          Chicane
        </text>
        <text transform="matrix(1 0 0 1 213.6 339.68)" className="st0 st1 st2">
          La Source
        </text>
      </g>
    </svg>
  );
};
