import React from 'react';
import { PathIcon } from '@phosphor-icons/react';

interface Props {
  trackRubbered: string | undefined;
}

export const WeatherTrackRubbered: React.FC<Props> = ({ trackRubbered }) => {
  return (
    <div className="bg-slate-800/70 p-2 rounded-sm">
    <div className="flex flex-row items-center gap-2">
      <span className="text-m text-gray-400 mr-1"><PathIcon /></span>
      <span className="text-sm capitalize">{trackRubbered ?? 'N/A'}</span>
    </div>
    </div>
  );
};
