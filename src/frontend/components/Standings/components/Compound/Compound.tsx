import tireCompoundImage from '../../../../assets/img/tire_compound.png';

const carsWithMultipleDryTires: number[] = [71, 99, 129, 145, 161];

interface CompoundProps {
  carId: number;
  tireCompound: number;
}

const compoundPositions: Record<number, { x: string; y: string }> = {
  0: { x: '0', y: '0' },
  1: { x: '0', y: '33%' },
  2: { x: '0', y: '66%' },
};

export const Compound = ({
  carId,
  tireCompound
}: CompoundProps) => {
  if (tireCompound < 0) {
    return null;
  }

  const tireIndex = carsWithMultipleDryTires.includes(carId)
    ? tireCompound
    : tireCompound === 0 ? 0 : 2;

  const position = compoundPositions[tireIndex];

  return (
    <span
      className={`inline-block w-[1em] h-[1em] shrink-0 bg-no-repeat bg-size-[100%_auto]`}
      style={{
        backgroundImage: `url(${tireCompoundImage})`,
        backgroundPosition: position ? `${position.x} ${position.y}` : '0 0',
      }}
    />
  );
};
