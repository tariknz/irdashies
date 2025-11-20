export interface InputGearProps {
  gear?: number;
  speedMs?: number;
  unit?: number;
  settings?: {
    unit: 'mph' | 'km/h' | 'auto';
  };
}

export const InputGear = ({
  gear,
  speedMs,
  unit,
  settings = { unit: 'auto' },
}: InputGearProps) => {
  const isMetric =
    (unit === 1 && settings.unit === 'auto') || settings.unit === 'km/h';
  const speed = (speedMs ?? 0) * (isMetric ? 3.6 : 2.23694);
  const displayUnit = isMetric ? 'km/h' : 'mph';
  let gearText = '';
  switch (gear) {
    case -1:
      gearText = 'R';
      break;
    case 0:
    case null:
    case undefined:
      gearText = 'N';
      break;
    default:
      gearText = `${gear}`;
      break;
  }

  return (
    <div
      className="flex items-center justify-center font-mono h-full w-full text-white"
    >
      <div className="flex flex-col items-center">
        <div
          className="font-bold leading-none"
          style={{ fontSize: 'min(20vw, 20vh)' }}
        >
          {gearText}
        </div>
        <div
          className="font-semibold"
          style={{ fontSize: 'min(15vw, 15vh)' }}
        >
          {speed.toFixed(0)}
        </div>
        <div
          className="text-gray-500 leading-none"
          style={{ fontSize: 'min(10vw, 10vh)' }}
        >
          {displayUnit}
        </div>
      </div>
    </div>
  );
};
