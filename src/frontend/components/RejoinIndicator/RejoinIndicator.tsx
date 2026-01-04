/**
 * Main Rejoin Indicator Component
 * Displays a widget showing the gap to the car behind and if its safe to rejoin, need to exercise caughtion or you should not rejoin until the car has passed
 * Hidden until player is at a user defined speed (Default 30) and not in the pit lane. The gap thresholds are user configured as well
 */

import React, { useMemo } from 'react';
import { useTelemetryValues, useTelemetryValue, useFocusCarIdx, useCarIdxSpeed } from '@irdashies/context';
import { useDriverRelatives } from '../Standings/hooks/useDriverRelatives';
import { useRejoinSettings } from './hooks/useRejoinSettings';
import { getTailwindStyle } from '@irdashies/utils/colors';

export const RejoinIndicator = () => {
  const settings = useRejoinSettings();
  const playerIndex = useFocusCarIdx();
  const telemetrySpeed = useTelemetryValues('Speed');
  const carSpeeds = useCarIdxSpeed();
  const isInGarage = useTelemetryValue<number>('IsInGarage') === 1;
  const playerInPitStall = useTelemetryValue<number>('PlayerCarInPitStall') === 1;
  const carIdxOnPitRoad = useTelemetryValues<boolean[]>('CarIdxOnPitRoad');

  // If we don't have dashboard settings or no focused player, hide
  if (!settings) return null;
  if (!settings.enabled) return null;
  if (playerIndex === undefined) return null;

  const drivers = useDriverRelatives({ buffer: 3 });
  // Choose the first car behind the player that is not in the pit lane or off-track
  let carBehind: any = undefined;
  let behindList: any[] = [];
  if (drivers && drivers.length) {
    const playerArrIndex = drivers.findIndex((d) => d.carIdx === playerIndex);
    if (playerArrIndex >= 0) {
      behindList = drivers.slice(playerArrIndex + 1);
      // Prefer the nearest car that is explicitly on-track (onTrack !== false) and not on pit road.
      // This skips pit-road/off-track cars and uses the next on-track car further back if present.
      const candidate = behindList.find((d) => d.onTrack !== false && !d.onPitRoad);

      // If we found a non-pit, on-track car behind the player, use it.
      // Otherwise, set carBehind to undefined so we don't fall back to a pit car.
      if (candidate) {
        carBehind = candidate;
      } else {
        carBehind = undefined;
      }
    }
  }

  // Read telemetry and computed car speed for the focused car index
  const telemetryPerCar = telemetrySpeed ?? [];
  const telemetrySpeedForPlayer = telemetryPerCar?.[playerIndex]; // likely m/s in live telemetry
  const carSpeedForPlayer = carSpeeds?.[playerIndex]; // km/h when available

  // Prefer the computed car speed (km/h). If not available, fall back to telemetry converted to km/h.
  const speedKmH = Number.isFinite(carSpeedForPlayer)
    ? carSpeedForPlayer
    : Number.isFinite(telemetrySpeedForPlayer)
    ? telemetrySpeedForPlayer * 3.6
    : 0;

  const gap = Math.abs(carBehind?.delta ?? Number.POSITIVE_INFINITY);
  const gapLabel = Number.isFinite(gap) ? gap.toFixed(1) : '--';

  // Exported helper below is used for unit testing the mapping
  const cfg = settings ? settings.config : { careGap: Number.POSITIVE_INFINITY, stopGap: Number.POSITIVE_INFINITY };
  const status = getStatusFromGap(gap, cfg);

  // Hide if we don't have dashboard settings or settings says disabled
  if (!settings) return null;
  if (!settings.enabled) return null;
  if (playerIndex === undefined) return null;

  // Player on pit road uses previously read telemetry
  const playerOnPitRoad = playerIndex !== undefined ? !!carIdxOnPitRoad?.[playerIndex] : false;

  // Decide visibility based on configured speed (km/h)
  const isHiddenBySpeed = speedKmH > settings.config.showAtSpeed;

  // Decide visibility based on player location (garage / pit stall / on pit road)
  const isHiddenByLocation = isInGarage || playerInPitStall || playerOnPitRoad;

  // Decide visibility when there is no valid on-track car behind
  const isHiddenByNoCarBehind = !Number.isFinite(gap);

  if (isHiddenBySpeed) return null;
  if (isHiddenByLocation) return null;
  if (isHiddenByNoCarBehind) return null;

  const statusBg =
    status.color === 'green' ? 'bg-green-700' : status.color === 'amber' ? 'bg-amber-600' : 'bg-red-700';

  return (
    <div className={`w-full flex justify-between rounded-sm p-2 font-bold text-white ${statusBg}`}>
      <div className="text-lg">{gapLabel}s</div>
      <div className="text-lg">{status.label}</div>
    </div>
  );
};

export function getStatusFromGap(gap: number, config: { careGap: number; stopGap: number }) {
  // If no gap data, treat as clear/safe
  if (!Number.isFinite(gap)) return { label: 'Clear', color: 'green' };
  if (gap >= config.careGap) return { label: 'Clear', color: 'green' };
  if (gap >= config.stopGap) return { label: 'Caution', color: 'amber' };
  return { label: 'Do Not Rejoin', color: 'red' };
}

export const RejoinIndicatorDisplay = ({
  gap,
  status,
}: {
  gap?: number | string;
  status?: 'Clear' | 'Caution' | 'Do Not Rejoin';
}) => {
  const statusBg =
    status === 'Clear'
      ? 'bg-green-700'
      : status === 'Caution'
      ? 'bg-amber-600'
      : 'bg-red-700';

  const gapLabel = gap ?? '--s';

  return (
    <div className={`w-full flex justify-between rounded-sm p-2 font-bold text-white ${statusBg}`}>
      <div className="text-lg">{gapLabel}</div>
      <div className="text-lg">{status}</div>
    </div>
  );
};