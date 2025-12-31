import React from 'react';
import { DropHalfIcon, DropIcon } from '@phosphor-icons/react';

interface Props {
    humidity: number | undefined;
}

export const WeatherHumidity: React.FC<Props> = ({ humidity }) => {
    const humidityValue = Number(humidity?.toFixed(2));
    const humidityPercent = humidityValue * 100;
    
    return (
        <div className="bg-slate-800/70 p-2 rounded-sm w-full">
            <div className="flex flex-row gap-x-2 items-center text-sm">
                {humidityPercent <= 50 ? <DropIcon /> : <DropHalfIcon />}
        <span className="grow">Humidity</span>
        <div className="text-center">{humidityPercent !== undefined ? `${humidityPercent}%` : 'N/A'}</div>
      </div>
    </div>
    );
};