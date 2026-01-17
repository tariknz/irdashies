import { useEffect, useState, useCallback } from 'react';
import { useSessionStore, useDriverCarIdx } from '../../../context/SessionStore/SessionStore';
import { useTelemetryValue } from '../../../context/TelemetryStore/TelemetryStore';
import { loadCarData, getGearKey, type CarData } from '../../../utils/carData';

/**
 * Hook for car-specific tachometer data from lovely-car-data
 */
export const useCarTachometerData = () => {
  const [carData, setCarData] = useState<CarData | null>(null);
  const [loading, setLoading] = useState(false);
  
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
  const loadData = useCallback(async (path: string, game: string) => {
    setLoading(true);
    try {
      const data = await loadCarData(path, game);
      setCarData(data);
    } catch {
      setCarData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load car data when car path changes
  useEffect(() => {
    if (!carPath) {
      setCarData(null);
      setLoading(false);
      return;
    }

    loadData(carPath, gameId);
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
    loading,
    gearRpmThresholds: getGearRpmThresholds(),
    hasCarData: !!carData,
  };
};