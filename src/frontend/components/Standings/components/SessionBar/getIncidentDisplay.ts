export const getIncidentDisplay = (
  incidents: number,
  initial: number | string | undefined | null,
  subsequent: number | string | undefined | null,
  limit: number | string | undefined | null
): string => {
  if (limit === 'unlimited' || !limit) {
    return `${incidents} / ∞ x`;
  }

  if (
    initial &&
    initial !== 'unlimited' &&
    (initial as number) >= (limit as number)
  ) {
    initial = undefined;
  }

  if (!initial || initial === 'unlimited') {
    return `${incidents} / ${limit} x`;
  }

  if (!subsequent || subsequent === 'unlimited') {
    if (incidents < (initial as number)) {
      return `${incidents} / ${initial} / ${limit} x`;
    }
    return `${incidents} / ${limit} x`;
  }

  if (incidents < (initial as number)) {
    return `${incidents} / ${initial} / ${limit} x`;
  }

  const initialNum = initial as number;
  const subsequentNum = subsequent as number;

  const roundsCompleted = Math.floor((incidents - initialNum) / subsequentNum);
  const nextPenalty = initialNum + (roundsCompleted + 1) * subsequentNum;

  if (nextPenalty >= (limit as number)) {
    return `${incidents} / ${limit} x`;
  }

  return `${incidents} / ${nextPenalty} / ${limit} x`;
};
