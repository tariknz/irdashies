/**
 * Main Fuel Calculator Component
 * Displays fuel consumption and pit stop information
 */

import { useMemo, useEffect } from 'react';
import { useTelemetryValues } from '@irdashies/context';
import { useFuelCalculation } from './useFuelCalculation';
import { formatFuel } from './fuelCalculations';
import type { FuelCalculatorSettings } from './types';
import styles from './FuelCalculator.module.css';

interface FuelCalculatorProps extends Partial<FuelCalculatorSettings> {}

export const FuelCalculator = ({
  fuelUnits = 'L',
  showConsumption = true,
  showLastLap = true,
  show3LapAvg = true,
  show10LapAvg = true,
  showPitWindow = true,
  showFuelSave = true,
  safetyMargin = 0.05,
  background = { opacity: 85 },
}: FuelCalculatorProps) => {
  // Component lifecycle tracking (disabled)
  // useEffect(() => {
  //   console.log('[FuelCalculator] Component MOUNTED');
  //   return () => console.log('[FuelCalculator] Component UNMOUNTED');
  // }, []);

  const fuelData = useFuelCalculation(safetyMargin);

  // Get current fuel level from telemetry even when no lap data
  const currentFuelLevel = useTelemetryValues('FuelLevel')?.[0] || 0;

  // Determine status color class - use neutral when no data
  const statusClass = useMemo(() => {
    if (!fuelData) return '';
    if (fuelData.canFinish) return styles.statusGreen;
    if (fuelData.pitWindowClose - fuelData.currentLap < 5)
      return styles.statusRed;
    return styles.statusYellow;
  }, [fuelData]);

  // Create display data - use fuelData if available, otherwise show current fuel
  const displayData = useMemo(() => {
    if (!fuelData) {
      // No lap data yet - just show current fuel level
      return {
        fuelLevel: currentFuelLevel,
        lastLapUsage: 0,
        avg3Laps: 0,
        avg10Laps: 0,
        lapsWithFuel: 0,
        fuelToFinish: 0,
        fuelToAdd: 0,
        canFinish: false,
        targetConsumption: 0,
        confidence: 'low' as const,
        pitWindowOpen: 0,
        pitWindowClose: 0,
        currentLap: 0,
      };
    }

    // If fuel level changed (e.g., in garage), recalculate laps with new fuel
    if (Math.abs(fuelData.fuelLevel - currentFuelLevel) > 0.1) {
      const avgFuelPerLap = fuelData.avg3Laps || fuelData.lastLapUsage;
      const lapsWithFuel = avgFuelPerLap > 0 ? Math.floor(currentFuelLevel / avgFuelPerLap) : 0;

      return {
        ...fuelData,
        fuelLevel: currentFuelLevel,
        lapsWithFuel,
        pitWindowClose: fuelData.currentLap + lapsWithFuel - 1,
      };
    }

    return fuelData;
  }, [fuelData, currentFuelLevel]);

  return (
    <div
      className={`w-full h-full ${styles.container} ${statusClass}`}
      style={
        {
          '--bg-opacity': `${background.opacity}%`,
        } as React.CSSProperties
      }
    >
      {/* Header: Current Fuel Level */}
      <div className={styles.header}>
        <div className={styles.title}>Fuel</div>
        <div className={styles.fuelRemaining}>
          <span className={styles.bigValue}>
            {formatFuel(displayData.fuelLevel, fuelUnits, 1).split(' ')[0]}
          </span>
          <span className={styles.unit}>{fuelUnits}</span>
        </div>
        <div className={styles.lapsRemaining}>
          {displayData.lapsWithFuel} laps
        </div>
      </div>

      {/* Fuel Consumption Details */}
      {showConsumption && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Consumption</div>
          {showLastLap && (
            <div className={styles.row}>
              <span className={styles.label}>Last Lap</span>
              <span className={styles.value}>
                {formatFuel(displayData.lastLapUsage, fuelUnits)}
              </span>
            </div>
          )}
          {show3LapAvg && (
            <div className={styles.row}>
              <span className={styles.label}>3 Lap Avg</span>
              <span className={styles.value}>
                {formatFuel(displayData.avg3Laps, fuelUnits)}
              </span>
            </div>
          )}
          {show10LapAvg && (
            <div className={styles.row}>
              <span className={styles.label}>10 Lap Avg</span>
              <span className={styles.value}>
                {formatFuel(displayData.avg10Laps, fuelUnits)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Pit Window */}
      {showPitWindow && !displayData.canFinish && fuelData && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Pit Window</div>
          <div className={styles.pitWindow}>
            <div className={styles.windowBar}>
              <div
                className={styles.windowRange}
                style={{
                  left: `${((displayData.pitWindowOpen - displayData.currentLap) / (fuelData.lapsRemaining || 1)) * 100}%`,
                  width: `${((displayData.pitWindowClose - displayData.pitWindowOpen) / (fuelData.lapsRemaining || 1)) * 100}%`,
                }}
              />
              <div
                className={styles.currentPosition}
                style={{ left: '0%' }}
              />
            </div>
            <div className={styles.windowText}>
              Lap {displayData.pitWindowOpen} - {displayData.pitWindowClose}
            </div>
          </div>
        </div>
      )}

      {/* Fuel Save Indicator */}
      {showFuelSave && !displayData.canFinish && fuelData && displayData.targetConsumption > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Fuel Save</div>
          <div className={styles.fuelSaveIndicator}>
            <div className={styles.targetBar}>
              <div className={styles.targetLine} />
              <div
                className={styles.currentMarker}
                style={{
                  left: `${Math.min(100, Math.max(0, ((displayData.lastLapUsage / displayData.targetConsumption - 0.5) / 1.0) * 100 + 50))}%`,
                }}
              />
            </div>
            <div
              className={`${styles.saveText} ${displayData.lastLapUsage > displayData.targetConsumption ? styles.over : styles.under}`}
            >
              {displayData.lastLapUsage > displayData.targetConsumption
                ? `${formatFuel(displayData.lastLapUsage - displayData.targetConsumption, fuelUnits)} over`
                : `${formatFuel(displayData.targetConsumption - displayData.lastLapUsage, fuelUnits)} under`}
            </div>
          </div>
        </div>
      )}

      {/* Footer: Key Information */}
      <div className={styles.footer}>
        <div className={styles.footerItem}>
          <span className={styles.label}>To Finish</span>
          <span className={styles.value}>
            {formatFuel(displayData.fuelToFinish, fuelUnits, 1)}
          </span>
        </div>
        {displayData.fuelToAdd > 0 && (
          <div className={styles.footerItem}>
            <span className={styles.label}>Add at Stop</span>
            <span className={styles.value}>
              {formatFuel(displayData.fuelToAdd, fuelUnits, 1)}
            </span>
          </div>
        )}
      </div>

      {/* Confidence Indicator - only show when we have actual data */}
      {fuelData && displayData.confidence !== 'high' && (
        <div className={styles.confidenceWarning}>
          {displayData.confidence === 'low'
            ? 'Low confidence - need more laps'
            : 'Medium confidence'}
        </div>
      )}

      {/* Garage Preview Indicator - show when we have lap data but fuel changed */}
      {fuelData && Math.abs(fuelData.fuelLevel - currentFuelLevel) > 0.1 && (
        <div className={styles.garagePreview}>
          🔧 Garage Preview - Fuel adjusted to {formatFuel(currentFuelLevel, fuelUnits, 1)}
        </div>
      )}
    </div>
  );
};
