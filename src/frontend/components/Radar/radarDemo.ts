import type { RadarFrame } from './components/RadarDisplay';

/**
 * A scripted pack for demo mode and stories: one car slides up the left,
 * one drops back on the right, and two run nose to tail ahead.
 */
export const demoRadarFrame = (seconds: number): RadarFrame => {
  const cycle = (seconds % 12) / 12;
  const wave = Math.sin(cycle * Math.PI * 2);
  return {
    playerPct: 0,
    playerSpeed: 0,
    trackLength: 0,
    cars: [
      {
        carIdx: 1,
        dist: -22 + cycle * 30,
        closingSpeed: 0,
        lane: -1,
        offTrack: false,
      },
      {
        carIdx: 2,
        dist: 3 - wave * 12,
        closingSpeed: 0,
        lane: 1,
        offTrack: false,
      },
      {
        carIdx: 3,
        dist: 16 + wave * 2,
        closingSpeed: 0,
        lane: 0,
        offTrack: false,
      },
      {
        carIdx: 4,
        dist: 23 + wave * 2,
        closingSpeed: 0,
        lane: 0,
        offTrack: false,
      },
    ],
  };
};

export const DEMO_LABELS: Readonly<Record<number, string>> = {
  1: '7',
  2: '24',
  3: '3',
  4: '88',
};
