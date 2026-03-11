export interface InputGearProps {
  gear?: number;
  speedMs?: number;
  unit?: number;
  settings?: {
    unit: 'mph' | 'km/h' | 'auto' | 'none';
    showspeed: boolean;
  };
}

export const InputGear = ({
  gear,
  speedMs,
  unit,
  settings = { unit: 'auto', showspeed: true },
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
    <div className="@container-[size] flex items-center justify-center p-1 font-mono w-full h-full">
      <div className="flex flex-col items-center">
        <div className="font-bold leading-none text-[max(2rem,min(80cqh,100cqw))]">
          {gearText}
        </div>
        {settings.showspeed && (
          <div className="text-[clamp(0.875rem,min(12cqh,16cqw),1.5rem)]">
            {speed.toFixed(0)}
          </div>
        )}
        {settings.showspeed && settings.unit !== 'none' && (
          <div className="text-gray-400 leading-none text-[clamp(0.625rem,min(6cqh,8cqw),1rem)]">
            {displayUnit}
          </div>
        )}
      </div>
    </div>
  );
};
