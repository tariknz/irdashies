import { getBrokenTrackInfo } from './tracks/broken-tracks';

interface TrackDebugProps {
  trackId: number;
}

export const TrackDebug = ({ trackId }: TrackDebugProps) => {
  const brokenTrackInfo = getBrokenTrackInfo(trackId);
  
  if (!brokenTrackInfo) {
    return null;
  }

  return (
    <div className="text-sm text-center">
      <div className="bg-red-600/20 text-red-100 p-2 mb-2 rounded-md">
        <p className="font-semibold">Error: {brokenTrackInfo.name} (ID: {trackId})</p>
        <p className="text-xs">Issue: {brokenTrackInfo.issue}</p>
      </div>
    </div>
  );
}; 