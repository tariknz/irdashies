import { Thermometer } from '@phosphor-icons/react';

export interface WeatherTempProps {
  title: string;
  value: string;
}

export const WeatherTemp = ({ title, value }: WeatherTempProps) => {
  return (
    <div className="font-extrabold text-xl uppercase text-center bg-slate-800 p-2 rounded-sm items-center">
      <div className="flex flex-row gap-x-2 items-center">
        <Thermometer />
        <span className="grow">{title}</span>
      </div>
      <div className="font-bold text-lg text-center">{value}</div>
    </div>
  );
};
