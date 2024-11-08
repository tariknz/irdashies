export interface InputGearProps {
  gear: number;
  speedMs: number;
}

export const InputGear = ({ gear, speedMs }: InputGearProps) => {
  const speed = speedMs * 3.6;
  return (
    <div className="flex items-center justify-center font-mono p-2">
      <div className="flex flex-col items-center text-white">
        <div className="text-4xl font-bold">{gear}</div>
        <div className="text-l">{speed.toFixed(0)}</div>
      </div>
    </div>
  );
};