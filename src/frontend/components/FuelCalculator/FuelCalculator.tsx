/**
 * Main Fuel Calculator Component
 * Displays fuel consumption and pit stop information
 */

import { useMemo, useEffect } from 'react';
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
  // Log component lifecycle
  useEffect(() => {
    console.log('[FuelCalculator] Component MOUNTED');
    return () => console.log('[FuelCalculator] Component UNMOUNTED');
  }, []);

  const fuelData = useFuelCalculation(safetyMargin);

  // Determine status color class
  const statusClass = useMemo(() => {
    if (!fuelData) return '';
    if (fuelData.canFinish) return styles.statusGreen;
    if (fuelData.pitWindowClose - fuelData.currentLap < 5)
      return styles.statusRed;
    return styles.statusYellow;
  }, [fuelData]);

  // Loading state - always visible
  if (!fuelData) {
    return (
      <div
        className="w-full h-full"
        style={{
          background: `rgba(20, 20, 20, ${background.opacity / 100})`,
          border: '2px solid rgba(60, 60, 60, 0.8)',
          borderRadius: '8px',
          padding: '16px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <div style={{
          fontSize: '12px',
          color: '#aaa',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Fuel Calculator
        </div>
        <div style={{
          color: '#888',
          fontSize: '14px',
          fontStyle: 'italic',
        }}>
          Waiting for telemetry data...
        </div>
      </div>
    );
  }

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
            {formatFuel(fuelData.fuelLevel, fuelUnits, 1).split(' ')[0]}
          </span>
          <span className={styles.unit}>{fuelUnits}</span>
        </div>
        <div className={styles.lapsRemaining}>
          {fuelData.lapsWithFuel} laps
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
                {formatFuel(fuelData.lastLapUsage, fuelUnits)}
              </span>
            </div>
          )}
          {show3LapAvg && (
            <div className={styles.row}>
              <span className={styles.label}>3 Lap Avg</span>
              <span className={styles.value}>
                {formatFuel(fuelData.avg3Laps, fuelUnits)}
              </span>
            </div>
          )}
          {show10LapAvg && (
            <div className={styles.row}>
              <span className={styles.label}>10 Lap Avg</span>
              <span className={styles.value}>
                {formatFuel(fuelData.avg10Laps, fuelUnits)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Pit Window */}
      {showPitWindow && !fuelData.canFinish && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Pit Window</div>
          <div className={styles.pitWindow}>
            <div className={styles.windowBar}>
              <div
                className={styles.windowRange}
                style={{
                  left: `${((fuelData.pitWindowOpen - fuelData.currentLap) / fuelData.lapsRemaining) * 100}%`,
                  width: `${((fuelData.pitWindowClose - fuelData.pitWindowOpen) / fuelData.lapsRemaining) * 100}%`,
                }}
              />
              <div
                className={styles.currentPosition}
                style={{ left: '0%' }}
              />
            </div>
            <div className={styles.windowText}>
              Lap {fuelData.pitWindowOpen} - {fuelData.pitWindowClose}
            </div>
          </div>
        </div>
      )}

      {/* Fuel Save Indicator */}
      {showFuelSave && !fuelData.canFinish && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Fuel Save</div>
          <div className={styles.fuelSaveIndicator}>
            <div className={styles.targetBar}>
              <div className={styles.targetLine} />
              <div
                className={styles.currentMarker}
                style={{
                  left: `${Math.min(100, Math.max(0, ((fuelData.lastLapUsage / fuelData.targetConsumption - 0.5) / 1.0) * 100 + 50))}%`,
                }}
              />
            </div>
            <div
              className={`${styles.saveText} ${fuelData.lastLapUsage > fuelData.targetConsumption ? styles.over : styles.under}`}
            >
              {fuelData.lastLapUsage > fuelData.targetConsumption
                ? `${formatFuel(fuelData.lastLapUsage - fuelData.targetConsumption, fuelUnits)} over`
                : `${formatFuel(fuelData.targetConsumption - fuelData.lastLapUsage, fuelUnits)} under`}
            </div>
          </div>
        </div>
      )}

      {/* Footer: Key Information */}
      <div className={styles.footer}>
        <div className={styles.footerItem}>
          <span className={styles.label}>To Finish</span>
          <span className={styles.value}>
            {formatFuel(fuelData.fuelToFinish, fuelUnits, 1)}
          </span>
        </div>
        {fuelData.fuelToAdd > 0 && (
          <div className={styles.footerItem}>
            <span className={styles.label}>Add at Stop</span>
            <span className={styles.value}>
              {formatFuel(fuelData.fuelToAdd, fuelUnits, 1)}
            </span>
          </div>
        )}
      </div>

      {/* Confidence Indicator */}
      {fuelData.confidence !== 'high' && (
        <div className={styles.confidenceWarning}>
          {fuelData.confidence === 'low'
            ? 'Low confidence - need more laps'
            : 'Medium confidence'}
        </div>
      )}
    </div>
  );
};
