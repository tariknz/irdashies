import { getColor } from '@irdashies/utils/colors';

export const getLedColorHex = (
  flagType: string,
  row: number,
  col: number,
  matrixSize: number,
  cols: number,
  rows: number
) => {
  const GREEN = getColor('green', 500);
  const YELLOW = getColor('yellow', 400);
  const BLUE = getColor('blue', 500);
  const RED = getColor('red', 500);
  const WHITE = '#ffffff';
  const BLACK = '#000000';
  const ORANGE = getColor('orange', 500);
  const GREY = getColor('gray', 400);
  const DARK = getColor('gray', 800);

  // If the visible flag is NO, always render grey
  if (flagType === 'NO') return GREY;

  // If matrixSize is 1 we render a uniform color across the full visual grid
  if (matrixSize === 1) {
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
    }

    if (flagType === 'CHECKERED') {
      return ((row + col) % 2 === 0) ? WHITE : DARK;
    }

    if (flagType === 'WHITE') return WHITE;
    if (flagType === 'BLACK') return BLACK;

    if (flagType === 'MEATBALL') {
      // Draw a circular meatball centered in the matrix. Radius scales with matrix size.
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;
      // Radius scales with matrix width so 8x8 also shows a visible orange circle
      const radius = Math.max(1, Math.floor(cols * 0.3));
      const dx = col - cx;
      const dy = row - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) return ORANGE;
      return BLACK;
    }

    // Default colored flags
    if (flagType === 'GREEN') return GREEN;
    if (flagType === 'YELLOW') return YELLOW;
    if (flagType === 'BLUE') {
      const diagonalThreshold = cols - 1;
      const diagonalPos = col + row;
      // Create a stripe of about 2-3 cells thick
      if (Math.abs(diagonalPos - diagonalThreshold) <= 1) return YELLOW;
      return BLUE;
    }
    if (flagType === 'DEBRIS') {
      return (row % 2 === 0) ? RED : YELLOW;
    }
    if (flagType === 'DISQUALIFIED') {
      const diag1 = row - col;
      const diag2 = row + col - (cols - 1);
      if (Math.abs(diag1) <= 1 || Math.abs(diag2) <= 1) return WHITE;
      return BLACK;
    }
  if (flagType === 'RED') return RED;

  return WHITE;
};
