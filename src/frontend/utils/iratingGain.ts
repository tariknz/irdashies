// Based on the Rust implementation provided in https://github.com/Turbo87/irating-rs

export interface RaceResult<D = unknown> {
  driver: D;
  finishRank: number; // u32
  startIRating: number; // u32
  started: boolean;
}

export interface CalculationResult<D = unknown> {
  raceResult: RaceResult<D>;
  iratingChange: number; // f32
  newIRating: number; // u32
}

function chance(a: number, b: number, factor: number): number {
  const expA = Math.exp(-a / factor);
  const expB = Math.exp(-b / factor);
  return (
    ((1 - expA) * expB) / ((1 - expB) * expA + (1 - expA) * expB)
  );
}

export function calculateIRatingGain<D>(
  raceResults: RaceResult<D>[],
): CalculationResult<D>[] {
  const br1 = 1600 / Math.LN2;

  const numRegistrations = raceResults.length;
  if (numRegistrations === 0) {
    return [];
  }

  const numStarters = raceResults.filter((r) => r.started).length;
  const numNonStarters = numRegistrations - numStarters;

  const chances: number[][] = raceResults.map((resultA) =>
    raceResults.map((resultB) =>
      chance(resultA.startIRating, resultB.startIRating, br1),
    ),
  );

  const expectedScores: number[] = chances.map(
    (chancesRow) => chancesRow.reduce((sum, val) => sum + val, 0) - 0.5,
  );

  const fudgeFactors: number[] = raceResults.map((result) => {
    if (!result.started) {
      return 0;
    }
    const x = numRegistrations - numNonStarters / 2;
    return (x / 2 - result.finishRank) / 100;
  });

  let sumChangesStarters = 0;
  const changesStarters: (number | null)[] = raceResults.map(
    (result, index) => {
      if (!result.started) {
        return null;
      }
      if (numStarters === 0) return 0;

      const expectedScore = expectedScores[index];
      const fudgeFactor = fudgeFactors[index];
      const change =
        ((numRegistrations -
          result.finishRank -
          expectedScore -
          fudgeFactor) *
          200) /
        numStarters;
      sumChangesStarters += change;
      return change;
    },
  );

  const expectedScoreNonStartersList: (number | null)[] = raceResults.map(
    (result, index) => (!result.started ? expectedScores[index] : null)
  );

  const sumExpectedScoreNonStarters: number = expectedScoreNonStartersList
    .filter((score): score is number => score !== null)
    .reduce((sum, val) => sum + val, 0);

  const avgExpectedScoreNonStarters = numNonStarters > 0 ? sumExpectedScoreNonStarters / numNonStarters : 0;

  const changesNonStarters: (number | null)[] = expectedScoreNonStartersList.map(
    (expectedScore) => {
      if (expectedScore === null) {
        return null;
      }
      if (numNonStarters === 0) return 0;
      if (avgExpectedScoreNonStarters === 0) return 0;

      return (
        (-sumChangesStarters / numNonStarters) *
        (expectedScore / avgExpectedScoreNonStarters)
      );
    },
  );

  const changes: number[] = raceResults.map((_result, index) => {
    const starterChange = changesStarters[index];
    const nonStarterChange = changesNonStarters[index];

    if (starterChange !== null) {
      return starterChange;
    }
    if (nonStarterChange !== null) {
      return nonStarterChange;
    }
    throw new Error(`Driver at index ${index} is neither starter nor non-starter.`);
  });

  return raceResults.map((result, index) => {
    const change = changes[index];
    const newIRating = Math.max(0, Math.round(result.startIRating + change));
    return {
      raceResult: result,
      iratingChange: change,
      newIRating: newIRating,
    };
  });
}
