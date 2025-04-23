import React from 'react';

// Predefined list of test data directories
export const TEST_DATA_DIRS = [
  '1745282969339',
  '1731637331038', // MultiClassPCCWithClio
  '1732274253573', // SupercarsRace
  '1732260478001', // AdvancedMX5
  '1732355190142', // GT3Practice
  '1735296198162', // PCCPacing
  '1731391056221', // MultiClassPCC
  '1732359661942', // GT3Race
  '1731732047131', // LegendsQualifying
  '1733030013074', // PCCRaceWithMicUse
  '1745282979879',
  '1745291694179',
];

interface DynamicTelemetrySelectorProps {
  onPathChange: (path: string) => void;
  initialPath?: string;
}

export const DynamicTelemetrySelector: React.FC<DynamicTelemetrySelectorProps> = ({
  onPathChange,
  initialPath = '/test-data/1735296198162',
}) => {
  const [selectedPath, setSelectedPath] = React.useState(initialPath);
  const [isManualInput, setIsManualInput] = React.useState(false);

  const handlePathChange = (newPath: string) => {
    setSelectedPath(newPath);
    onPathChange(newPath);
  };

  return (
    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          id="manual-input"
          checked={isManualInput}
          onChange={(e) => setIsManualInput(e.target.checked)}
        />
        <label htmlFor="manual-input">Manual path input</label>
      </div>
      
      {isManualInput ? (
        <input
          type="text"
          value={selectedPath}
          onChange={(e) => handlePathChange(e.target.value)}
          placeholder="Enter full telemetry path"
          style={{ padding: '0.5rem' }}
        />
      ) : (
        <select
          value={selectedPath}
          onChange={(e) => handlePathChange(e.target.value)}
          style={{ padding: '0.5rem' }}
        >
          {TEST_DATA_DIRS.map((dir) => (
            <option key={dir} value={`/test-data/${dir}`}>
              {dir}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}; 