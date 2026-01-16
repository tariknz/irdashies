import { useEffect, useState, useCallback } from 'react';
import { useSessionStore, useDriverCarIdx } from '../../../context/SessionStore/SessionStore';
import { useTelemetryValue } from '../../../context/TelemetryStore/TelemetryStore';
import { loadCarData, getGearKey, type CarData } from '../../../utils/carData';

/**
 * Hook for car-specific tachometer data from lovely-car-data
 */
export const useCarTachometerData = () => {
  const [carData, setCarData] = useState<CarData | null>(null);
  
  const driverCarIdx = useDriverCarIdx();
  const session = useSessionStore((state) => state.session);
  const gear = useTelemetryValue('Gear') ?? 0;
  
  // Get current car path and game
  const carPath = session?.DriverInfo?.Drivers?.find(
    (driver) => driver.CarIdx === driverCarIdx
  )?.CarPath;
  
  // Extract game ID from session (this would need to be added to session data)
  // For now, default to 'iracing' since that's what IRDashies primarily supports
  const gameId = 'iracing'; // TODO: Get from session data when available

  // Memoized load function
  const loadData = useCallback((path: string, game: string) => {
    const data = loadCarData(path, game);
    return data;
  }, []);

  // Load car data when car path changes
  useEffect(() => {
    if (!carPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCarData(null);
      return;
    }

    const data = loadData(carPath, gameId);
    setCarData(data);
  }, [carPath, gameId, loadData]);

  // Get gear-specific RPM thresholds
  const getGearRpmThresholds = (): number[] | null => {
    if (!carData?.ledRpm?.[0]) return null;
    
    const gearKey = getGearKey(gear);
    const gearData = carData.ledRpm[0][gearKey];
    
    return gearData || null;
  };

  return {
    carData,
    gearRpmThresholds: getGearRpmThresholds(),
    hasCarData: !!carData,
  };
};