import { TrackDrawing } from './TrackCanvas';
import { getBrokenTrackInfo } from './tracks/broken-tracks';

interface TrackDebugProps {
  trackId: number;
  trackDrawing: TrackDrawing;
}

export const TrackDebug = ({ trackId, trackDrawing }: TrackDebugProps) => {
  const brokenTrackInfo = getBrokenTrackInfo(trackId);
  
  // Check for missing track data
  if (!trackDrawing?.active?.inside) {
    return (
      <div className="text-sm text-center">
        <div className="bg-yellow-600/20 text-yellow-100 p-2 rounded-md">
          <p className="font-semibold">Warning: Track path unavailable</p>
          <p className="text-xs">Track ID: {trackId}</p>
        </div>
      </div>
    );
  }

  if (!trackDrawing?.startFinish?.point) {
    return (
      <div className="text-sm text-center p-2">
        <div className="bg-yellow-600/20 text-yellow-100 p-2 rounded-md">
          <p className="font-semibold">Warning: Track start point unavailable</p>
          <p className="text-xs">Track ID: {trackId}</p>
        </div>
      </div>
    );
  }

  // Show broken track error if applicable
  if (brokenTrackInfo) {
    return (
      <div className="text-sm text-center p-2">
        <div className="bg-red-600/20 text-red-100 p-2 rounded-md">
          <p className="font-semibold">Error: {brokenTrackInfo.name} (ID: {trackId})</p>
          <p className="text-xs">Issue: {brokenTrackInfo.issue}</p>
        </div>
      </div>
    );
  }

  // No issues found
  return null;
}; 