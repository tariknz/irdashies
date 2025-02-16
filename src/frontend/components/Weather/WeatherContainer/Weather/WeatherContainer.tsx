import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useTrackTemperature } from '../../../Standings/hooks/useTrackTemperature'
import { useTrackWeather } from '../../../Standings/hooks/useTrackWetness';
import { Drop, Sun, Thermometer } from '@phosphor-icons/react';
import { WindDirection } from '../../WindDirection/Weather/WindDirection';

export const WeatherContainer = () => {
   const [parent] = useAutoAnimate();
   const weather = useTrackWeather();
   const TRACK_WETNESS = `w-[${Math.floor(Number(weather.trackMoisture?.value) / 7 * 100)}%]`;
   const HEADER_STYLE = 'font-extrabold text-xl uppercase  text-center  bg-opacity-100 rounded bg-slate-800 p-2 rounded items-center';
   const METER_STYLE = `bg-blue-600 h-2.5 rounded-full ${TRACK_WETNESS}`;
  
   const TRACK_TEMP = useTrackTemperature();
   return (
      <div className="h-full inline-flex flex-row border-1 bg-slate-800 bg-opacity-25 rounded" ref={parent}>
         <div className="flex flex-col p-2  basis-full rounded  gap-2">
            <div className={HEADER_STYLE}>
               <div className='flex flex-row gap-x-2 items-center'>
                  <Thermometer className="text-lg align-center" />
                  <span className='grow'>Track Temp</span>
               </div>
               <div className='font-bold text-lg text-center'>{TRACK_TEMP.trackTemp}</div></div>

            <div className={HEADER_STYLE}>

               <div className='flex flex-row gap-x-2 items-center'>
                  <Thermometer />
                  <span className='grow'>Air Temp</span>
               </div>

               <div className='font-bold text-lg text-center'>{TRACK_TEMP.airTemp}</div>
            </div>
            <div className={HEADER_STYLE}>TRACK WETNESS
               <div className='font-bold text-lg text-center'>
                  <div className='flex flex-row gap-x-1'>
                     <Sun />
                     <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 align-center">

                        <div className={METER_STYLE}></div>
                     </div>
                     <Drop />

                  </div>
                  <div className='font-normal'>{weather.trackState ?? 'Unknown'}</div>
               </div>
            </div>
            <div className={HEADER_STYLE}>
               <WindDirection />
            </div>
         </div>
      </div>)
}

