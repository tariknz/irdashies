import React from 'react';
import { useTimingInterpolation } from '@irdashies/context';

export const TimingDebugInfo: React.FC = () => {
  const timingInterpolation = useTimingInterpolation();
  const stats = timingInterpolation.getStats();

  const getStatusColor = () => {
    if (stats.sessionState === 'Racing' && stats.isRecording) {
      return stats.totalCarClasses > 0 ? '#22c55e' : '#f59e0b'; // Green if has data, yellow if recording but no data
    }
    return '#6b7280'; // Gray if not racing/recording
  };

  const getStatusText = () => {
    if (stats.sessionState !== 'Racing') {
      return `${stats.sessionState} - Not Recording`;
    }
    if (!stats.isRecording) {
      return 'Racing - Not Recording';
    }
    if (stats.totalCarClasses === 0) {
      return 'Recording - No Data Yet';
    }
    return `Recording - ${stats.totalCarClasses} Car Classes`;
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        minWidth: '300px',
        zIndex: 9999,
        border: `2px solid ${getStatusColor()}`,
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 'bold', color: getStatusColor() }}>
        🏁 Timing Interpolation Status
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Status:</strong> {getStatusText()}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Session:</strong> {stats.sessionState} | <strong>Recording:</strong> {stats.isRecording ? '✅' : '❌'}
      </div>

      {stats.totalCarClasses > 0 && (
        <>
          <div style={{ marginBottom: '4px' }}>
            <strong>Car Classes:</strong> {stats.totalCarClasses}
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            {Object.entries(stats.bestLapTimes).map(([classId, lapTime]) => (
              <div key={classId} style={{ marginLeft: '10px', fontSize: '11px' }}>
                Class {classId}: {lapTime.toFixed(3)}s ({stats.dataPoints[parseInt(classId)] || 0} points)
              </div>
            ))}
          </div>
        </>
      )}

      {stats.lastInterpolationUsage && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #374151', paddingTop: '8px' }}>
          <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
            Last Usage ({formatTimestamp(stats.lastInterpolationUsage.timestamp)}):
          </div>
          <div style={{ marginLeft: '10px', fontSize: '11px' }}>
            <div>Cars: {stats.lastInterpolationUsage.playerCarIdx} vs {stats.lastInterpolationUsage.otherCarIdx}</div>
            <div style={{ color: stats.lastInterpolationUsage.usedInterpolation ? '#22c55e' : '#f59e0b' }}>
              {stats.lastInterpolationUsage.usedInterpolation ? '🎯 Used Interpolation' : `⚠️ Used Fallback: ${stats.lastInterpolationUsage.fallbackReason}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
