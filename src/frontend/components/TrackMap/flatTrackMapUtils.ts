export const progressToPathIndex = (progress: number, pathLength: number): number => {
  return Math.round(progress * (pathLength - 1));
};
