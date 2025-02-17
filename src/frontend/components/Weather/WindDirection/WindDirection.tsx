import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useTrackWeather } from '../../Standings/hooks/useTrackWetness';

export const WindDirection = () => {
  const [parent] = useAutoAnimate();
  const weather = useTrackWeather();
  const windSpeed = weather.windVelo?.value[0] * (18 / 5);
  const windDirectionValue =
    weather.windDirection?.value[0] - weather.windYaw?.value[0];

  return (
    <div
      id="wind"
      ref={parent}
      className="flex shrink h-full relative min-h-[200px] bg-slate-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-2 -2 64 64"
        className={`absolute stroke-current stroke-4 w-full h-full box-border fill-none  origin-center transform-gpu`}
        style={{
          rotate: `calc(${windDirectionValue} * 1rad + 0.5turn)`,
        }}
      >
        <path d="M50.0262 7.6624A29.9248 29.9248 90 0160 30c0 16.5685-13.4315 30-30 30S0 46.5685 0 30A29.9254 29.9254 90 0110.0078 7.632M21.5147 8.5 30 .0147 38.4853 8.5" />
      </svg>
      <div className="absolute w-full h-full flex justify-center items-center text-[10vmin]">
        {windSpeed.toFixed()}
      </div>
    </div>
  );
};
