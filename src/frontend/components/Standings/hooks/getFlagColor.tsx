import { getColor } from '@irdashies/utils/colors';

export const getFlagColor = (flagType: string) => {
  const GREEN = getColor('green', 500);
  const YELLOW = getColor('yellow', 400);
  const BLUE = getColor('blue', 500);
  const RED = getColor('red', 500);
  const WHITE = '#ffffff';
  const BLACK = '#000000';
  const ORANGE = getColor('orange', 500);
  const GREY = getColor('gray', 400);

  if (flagType === 'NO') return GREY;
  if (flagType === 'CHECKERED') return WHITE;
  if (flagType === 'WHITE') return WHITE;
  if (flagType === 'BLACK') return BLACK;
  if (flagType === 'DISQUALIFIED') return BLACK;
  if (flagType === 'MEATBALL') return ORANGE;
  if (flagType === 'GREEN') return GREEN;
  if (flagType === 'YELLOW') return YELLOW;
  if (flagType === 'BLUE') return BLUE;
  if (flagType === 'RED') return RED;
  if (flagType === 'DEBRIS') return YELLOW;
  return WHITE;
};
