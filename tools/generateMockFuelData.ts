/**
 * Mock Telemetry Data Generator for Fuel Calculator Testing
 *
 * Generates realistic multi-lap telemetry data with various scenarios:
 * - Normal laps with consistent fuel consumption
 * - Pit stops with fuel refills
 * - Yellow flag laps
 * - Varying consumption (fuel saving vs pushing)
 * - Out-laps from pits
 *
 * Usage:
 *   npx tsx tools/generateMockFuelData.ts [scenario]
 *
 * Scenarios:
 *   normal     - Normal race with consistent consumption (default)
 *   pitstop    - Race with pit stop and refuel
 *   yellow     - Race with yellow flag periods
 *   saving     - Race with fuel saving mode
 *   multiclass - Multi-class race simulation
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Configuration
const TRACK_LENGTH = 2.5; // miles
const LAP_TIME_BASE = 90; // seconds
const FUEL_PER_LAP_BASE = 2.1; // liters
const FUEL_TANK_CAPACITY = 60; // liters
const TOTAL_RACE_LAPS = 30;
const RACE_DURATION = 45 * 60; // 45 minutes in seconds

interface TelemetrySnapshot {
  SessionTime: number;
  SessionNum: number;
  SessionFlags: number;
  SessionTimeRemain: number;
  SessionLapsRemain: number;
  SessionLapsTotal: number;
  Lap: number;
  LapDistPct: number;
  FuelLevel: number;
  FuelLevelPct: number;
  OnPitRoad: number;
  CarIdxLap: number[];
  CarIdxPosition: number[];
  CarIdxLastLapTime: number[];
}

// Session flags
const GREEN_FLAG = 0x00000001;
const YELLOW_FLAG = 0x00002000;
const CHECKERED_FLAG = 0x00000100;

function generateNormalRace(): TelemetrySnapshot[] {
  const snapshots: TelemetrySnapshot[] = [];
  let sessionTime = 0;
  let fuelLevel = FUEL_TANK_CAPACITY;
  let currentLap = 1;

  console.log('Generating normal race scenario...');

  // Generate telemetry for each lap
  for (let lap = 1; lap <= TOTAL_RACE_LAPS; lap++) {
    const lapTime = LAP_TIME_BASE + (Math.random() - 0.5) * 2; // ±1 second variation
    const fuelUsed = FUEL_PER_LAP_BASE + (Math.random() - 0.5) * 0.2; // ±0.1L variation

    // Generate snapshots throughout the lap
    const snapshotsPerLap = 20;
    for (let i = 0; i < snapshotsPerLap; i++) {
      const lapDistPct = i / snapshotsPerLap;
      const lapProgress = i / snapshotsPerLap;

      snapshots.push({
        SessionTime: sessionTime + lapProgress * lapTime,
        SessionNum: 0,
        SessionFlags: lap === TOTAL_RACE_LAPS && i === snapshotsPerLap - 1 ? CHECKERED_FLAG : GREEN_FLAG,
        SessionTimeRemain: RACE_DURATION - (sessionTime + lapProgress * lapTime),
        SessionLapsRemain: TOTAL_RACE_LAPS - lap + 1,
        SessionLapsTotal: TOTAL_RACE_LAPS,
        Lap: currentLap,
        LapDistPct: lapDistPct,
        FuelLevel: fuelLevel - (fuelUsed * lapProgress),
        FuelLevelPct: (fuelLevel - (fuelUsed * lapProgress)) / FUEL_TANK_CAPACITY,
        OnPitRoad: 0,
        CarIdxLap: Array(64).fill(-1).map((_, idx) => idx === 19 ? currentLap : -1),
        CarIdxPosition: Array(64).fill(0).map((_, idx) => idx === 19 ? 1 : 0),
        CarIdxLastLapTime: Array(64).fill(-1).map((_, idx) => idx === 19 ? lapTime : -1),
      });
    }

    sessionTime += lapTime;
    fuelLevel -= fuelUsed;
    currentLap++;
  }

  console.log(`Generated ${snapshots.length} snapshots for ${TOTAL_RACE_LAPS} laps`);
  return snapshots;
}

function generatePitStopRace(): TelemetrySnapshot[] {
  const snapshots: TelemetrySnapshot[] = [];
  let sessionTime = 0;
  let fuelLevel = FUEL_TANK_CAPACITY * 0.6; // Start with 60% fuel
  let currentLap = 1;
  const pitLap = 15; // Pit on lap 15
  const pitDuration = 30; // 30 second pit stop

  console.log('Generating pit stop race scenario...');

  for (let lap = 1; lap <= TOTAL_RACE_LAPS; lap++) {
    const lapTime = LAP_TIME_BASE + (Math.random() - 0.5) * 2;
    const fuelUsed = FUEL_PER_LAP_BASE + (Math.random() - 0.5) * 0.2;

    // Check if this is pit lap
    if (lap === pitLap) {
      // Generate in-lap (entering pits)
      const snapshotsPerLap = 20;
      for (let i = 0; i < snapshotsPerLap; i++) {
        const lapDistPct = i / snapshotsPerLap;
        const lapProgress = i / snapshotsPerLap;
        const isOnPitRoad = i > snapshotsPerLap * 0.7 ? 1 : 0; // Enter pit road at 70% through lap

        snapshots.push({
          SessionTime: sessionTime + lapProgress * lapTime,
          SessionNum: 0,
          SessionFlags: GREEN_FLAG,
          SessionTimeRemain: RACE_DURATION - (sessionTime + lapProgress * lapTime),
          SessionLapsRemain: TOTAL_RACE_LAPS - lap + 1,
          SessionLapsTotal: TOTAL_RACE_LAPS,
          Lap: currentLap,
          LapDistPct: lapDistPct,
          FuelLevel: fuelLevel - (fuelUsed * lapProgress),
          FuelLevelPct: (fuelLevel - (fuelUsed * lapProgress)) / FUEL_TANK_CAPACITY,
          OnPitRoad: isOnPitRoad,
          CarIdxLap: Array(64).fill(-1).map((_, idx) => idx === 19 ? currentLap : -1),
          CarIdxPosition: Array(64).fill(0).map((_, idx) => idx === 19 ? 1 : 0),
          CarIdxLastLapTime: Array(64).fill(-1),
        });
      }

      sessionTime += lapTime;
      fuelLevel -= fuelUsed;

      // Pit stop - refuel to full tank
      fuelLevel = FUEL_TANK_CAPACITY;
      sessionTime += pitDuration;

      // Out-lap (exiting pits)
      currentLap++;
      const outLapTime = lapTime + 10; // Out-lap is slower
      const outLapFuel = fuelUsed * 0.5; // Less fuel used on out-lap
      for (let i = 0; i < 20; i++) {
        const lapDistPct = i / 20;
        const lapProgress = i / 20;
        const isOnPitRoad = i < 5 ? 1 : 0; // Exit pit road early in lap

        snapshots.push({
          SessionTime: sessionTime + lapProgress * outLapTime,
          SessionNum: 0,
          SessionFlags: GREEN_FLAG,
          SessionTimeRemain: RACE_DURATION - (sessionTime + lapProgress * outLapTime),
          SessionLapsRemain: TOTAL_RACE_LAPS - lap,
          SessionLapsTotal: TOTAL_RACE_LAPS,
          Lap: currentLap,
          LapDistPct: lapDistPct,
          FuelLevel: fuelLevel - (outLapFuel * lapProgress),
          FuelLevelPct: (fuelLevel - (outLapFuel * lapProgress)) / FUEL_TANK_CAPACITY,
          OnPitRoad: isOnPitRoad,
          CarIdxLap: Array(64).fill(-1).map((_, idx) => idx === 19 ? currentLap : -1),
          CarIdxPosition: Array(64).fill(0).map((_, idx) => idx === 19 ? 1 : 0),
          CarIdxLastLapTime: Array(64).fill(-1).map((_, idx) => idx === 19 ? outLapTime : -1),
        });
      }

      sessionTime += outLapTime;
      fuelLevel -= outLapFuel;
      currentLap++;
    } else {
      // Normal lap
      const snapshotsPerLap = 20;
      for (let i = 0; i < snapshotsPerLap; i++) {
        const lapDistPct = i / snapshotsPerLap;
        const lapProgress = i / snapshotsPerLap;

        snapshots.push({
          SessionTime: sessionTime + lapProgress * lapTime,
          SessionNum: 0,
          SessionFlags: GREEN_FLAG,
          SessionTimeRemain: RACE_DURATION - (sessionTime + lapProgress * lapTime),
          SessionLapsRemain: TOTAL_RACE_LAPS - lap + 1,
          SessionLapsTotal: TOTAL_RACE_LAPS,
          Lap: currentLap,
          LapDistPct: lapDistPct,
          FuelLevel: fuelLevel - (fuelUsed * lapProgress),
          FuelLevelPct: (fuelLevel - (fuelUsed * lapProgress)) / FUEL_TANK_CAPACITY,
          OnPitRoad: 0,
          CarIdxLap: Array(64).fill(-1).map((_, idx) => idx === 19 ? currentLap : -1),
          CarIdxPosition: Array(64).fill(0).map((_, idx) => idx === 19 ? 1 : 0),
          CarIdxLastLapTime: Array(64).fill(-1).map((_, idx) => idx === 19 ? lapTime : -1),
        });
      }

      sessionTime += lapTime;
      fuelLevel -= fuelUsed;
      currentLap++;
    }
  }

  console.log(`Generated ${snapshots.length} snapshots with pit stop at lap ${pitLap}`);
  return snapshots;
}

function generateYellowFlagRace(): TelemetrySnapshot[] {
  const snapshots: TelemetrySnapshot[] = [];
  let sessionTime = 0;
  let fuelLevel = FUEL_TANK_CAPACITY;
  let currentLap = 1;
  const yellowLaps = [8, 9, 10]; // Yellow flag on laps 8-10

  console.log('Generating yellow flag race scenario...');

  for (let lap = 1; lap <= TOTAL_RACE_LAPS; lap++) {
    const isYellow = yellowLaps.includes(lap);
    const lapTime = isYellow ? LAP_TIME_BASE + 20 : LAP_TIME_BASE + (Math.random() - 0.5) * 2;
    const fuelUsed = isYellow ? FUEL_PER_LAP_BASE * 0.4 : FUEL_PER_LAP_BASE + (Math.random() - 0.5) * 0.2;

    const snapshotsPerLap = 20;
    for (let i = 0; i < snapshotsPerLap; i++) {
      const lapDistPct = i / snapshotsPerLap;
      const lapProgress = i / snapshotsPerLap;

      snapshots.push({
        SessionTime: sessionTime + lapProgress * lapTime,
        SessionNum: 0,
        SessionFlags: isYellow ? YELLOW_FLAG : GREEN_FLAG,
        SessionTimeRemain: RACE_DURATION - (sessionTime + lapProgress * lapTime),
        SessionLapsRemain: TOTAL_RACE_LAPS - lap + 1,
        SessionLapsTotal: TOTAL_RACE_LAPS,
        Lap: currentLap,
        LapDistPct: lapDistPct,
        FuelLevel: fuelLevel - (fuelUsed * lapProgress),
        FuelLevelPct: (fuelLevel - (fuelUsed * lapProgress)) / FUEL_TANK_CAPACITY,
        OnPitRoad: 0,
        CarIdxLap: Array(64).fill(-1).map((_, idx) => idx === 19 ? currentLap : -1),
        CarIdxPosition: Array(64).fill(0).map((_, idx) => idx === 19 ? 1 : 0),
        CarIdxLastLapTime: Array(64).fill(-1).map((_, idx) => idx === 19 ? lapTime : -1),
      });
    }

    sessionTime += lapTime;
    fuelLevel -= fuelUsed;
    currentLap++;
  }

  console.log(`Generated ${snapshots.length} snapshots with yellow flags on laps ${yellowLaps.join(', ')}`);
  return snapshots;
}

function generateFuelSavingRace(): TelemetrySnapshot[] {
  const snapshots: TelemetrySnapshot[] = [];
  let sessionTime = 0;
  let fuelLevel = FUEL_TANK_CAPACITY * 0.7; // Start with less fuel
  let currentLap = 1;
  const savingStartLap = 20; // Start saving fuel at lap 20

  console.log('Generating fuel saving race scenario...');

  for (let lap = 1; lap <= TOTAL_RACE_LAPS; lap++) {
    const isSaving = lap >= savingStartLap;
    const lapTime = isSaving ? LAP_TIME_BASE + 3 : LAP_TIME_BASE + (Math.random() - 0.5) * 2;
    const fuelUsed = isSaving
      ? FUEL_PER_LAP_BASE * 0.85 // 15% reduction when saving
      : FUEL_PER_LAP_BASE + (Math.random() - 0.5) * 0.2;

    const snapshotsPerLap = 20;
    for (let i = 0; i < snapshotsPerLap; i++) {
      const lapDistPct = i / snapshotsPerLap;
      const lapProgress = i / snapshotsPerLap;

      snapshots.push({
        SessionTime: sessionTime + lapProgress * lapTime,
        SessionNum: 0,
        SessionFlags: GREEN_FLAG,
        SessionTimeRemain: RACE_DURATION - (sessionTime + lapProgress * lapTime),
        SessionLapsRemain: TOTAL_RACE_LAPS - lap + 1,
        SessionLapsTotal: TOTAL_RACE_LAPS,
        Lap: currentLap,
        LapDistPct: lapDistPct,
        FuelLevel: fuelLevel - (fuelUsed * lapProgress),
        FuelLevelPct: (fuelLevel - (fuelUsed * lapProgress)) / FUEL_TANK_CAPACITY,
        OnPitRoad: 0,
        CarIdxLap: Array(64).fill(-1).map((_, idx) => idx === 19 ? currentLap : -1),
        CarIdxPosition: Array(64).fill(0).map((_, idx) => idx === 19 ? 1 : 0),
        CarIdxLastLapTime: Array(64).fill(-1).map((_, idx) => idx === 19 ? lapTime : -1),
      });
    }

    sessionTime += lapTime;
    fuelLevel -= fuelUsed;
    currentLap++;
  }

  console.log(`Generated ${snapshots.length} snapshots with fuel saving from lap ${savingStartLap}`);
  return snapshots;
}

// Convert snapshots to full telemetry format
function snapshotsToTelemetry(snapshots: TelemetrySnapshot[]) {
  return snapshots.map(snapshot => ({
    SessionTime: {
      countAsTime: false,
      length: 1,
      name: 'SessionTime',
      description: 'Seconds since session start',
      unit: 's',
      varType: 5,
      value: [snapshot.SessionTime]
    },
    SessionNum: {
      countAsTime: false,
      length: 1,
      name: 'SessionNum',
      description: 'Session number',
      unit: '',
      varType: 2,
      value: [snapshot.SessionNum]
    },
    SessionFlags: {
      countAsTime: false,
      length: 1,
      name: 'SessionFlags',
      description: 'Session flags',
      unit: 'irsdk_Flags',
      varType: 3,
      value: [snapshot.SessionFlags]
    },
    SessionTimeRemain: {
      countAsTime: false,
      length: 1,
      name: 'SessionTimeRemain',
      description: 'Seconds left till session ends',
      unit: 's',
      varType: 5,
      value: [snapshot.SessionTimeRemain]
    },
    SessionLapsRemain: {
      countAsTime: false,
      length: 1,
      name: 'SessionLapsRemain',
      description: 'Laps left till session ends',
      unit: '',
      varType: 2,
      value: [snapshot.SessionLapsRemain]
    },
    SessionLapsTotal: {
      countAsTime: false,
      length: 1,
      name: 'SessionLapsTotal',
      description: 'Total number of laps in session',
      unit: '',
      varType: 2,
      value: [snapshot.SessionLapsTotal]
    },
    Lap: {
      countAsTime: false,
      length: 1,
      name: 'Lap',
      description: 'Current lap number',
      unit: '',
      varType: 2,
      value: [snapshot.Lap]
    },
    LapDistPct: {
      countAsTime: false,
      length: 1,
      name: 'LapDistPct',
      description: 'Percentage distance around lap',
      unit: '%',
      varType: 4,
      value: [snapshot.LapDistPct]
    },
    FuelLevel: {
      countAsTime: false,
      length: 1,
      name: 'FuelLevel',
      description: 'Fuel level in tank',
      unit: 'l',
      varType: 4,
      value: [snapshot.FuelLevel]
    },
    FuelLevelPct: {
      countAsTime: false,
      length: 1,
      name: 'FuelLevelPct',
      description: 'Fuel level as percentage of tank capacity',
      unit: '%',
      varType: 4,
      value: [snapshot.FuelLevelPct]
    },
    OnPitRoad: {
      countAsTime: false,
      length: 1,
      name: 'OnPitRoad',
      description: 'On pit road between the cones',
      unit: '',
      varType: 2,
      value: [snapshot.OnPitRoad]
    },
    CarIdxLap: {
      countAsTime: false,
      length: 64,
      name: 'CarIdxLap',
      description: 'Laps started by car index',
      unit: '',
      varType: 2,
      value: snapshot.CarIdxLap
    },
    CarIdxPosition: {
      countAsTime: false,
      length: 64,
      name: 'CarIdxPosition',
      description: 'Cars position in race by car index',
      unit: '',
      varType: 2,
      value: snapshot.CarIdxPosition
    },
    CarIdxLastLapTime: {
      countAsTime: false,
      length: 64,
      name: 'CarIdxLastLapTime',
      description: 'Cars last lap time',
      unit: 's',
      varType: 4,
      value: snapshot.CarIdxLastLapTime
    },
    PlayerCarIdx: {
      countAsTime: false,
      length: 1,
      name: 'PlayerCarIdx',
      description: 'Players carIdx',
      unit: '',
      varType: 2,
      value: [19]
    }
  }));
}

// Main execution
async function main() {
  const scenario = process.argv[2] || 'normal';

  let snapshots: TelemetrySnapshot[];
  let scenarioName: string;

  switch (scenario.toLowerCase()) {
    case 'pitstop':
      snapshots = generatePitStopRace();
      scenarioName = 'pitstop';
      break;
    case 'yellow':
      snapshots = generateYellowFlagRace();
      scenarioName = 'yellow';
      break;
    case 'saving':
      snapshots = generateFuelSavingRace();
      scenarioName = 'fuel-saving';
      break;
    case 'normal':
    default:
      snapshots = generateNormalRace();
      scenarioName = 'normal';
  }

  const telemetry = snapshotsToTelemetry(snapshots);

  // Create output directory
  const outputDir = path.join(process.cwd(), 'test-data', 'mock-fuel', scenarioName);
  await mkdir(outputDir, { recursive: true });

  // Write telemetry file
  const telemetryPath = path.join(outputDir, 'telemetry-sequence.json');
  await writeFile(telemetryPath, JSON.stringify(telemetry, null, 2), 'utf-8');

  // Write metadata
  const metadata = {
    scenario: scenarioName,
    totalSnapshots: snapshots.length,
    totalLaps: TOTAL_RACE_LAPS,
    trackLength: TRACK_LENGTH,
    fuelTankCapacity: FUEL_TANK_CAPACITY,
    avgFuelPerLap: FUEL_PER_LAP_BASE,
    avgLapTime: LAP_TIME_BASE,
    generated: new Date().toISOString()
  };
  const metadataPath = path.join(outputDir, 'metadata.json');
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(`\n✅ Successfully generated mock fuel data!`);
  console.log(`   Scenario: ${scenarioName}`);
  console.log(`   Output: ${outputDir}`);
  console.log(`   Files: telemetry-sequence.json, metadata.json`);
  console.log(`\nTo generate other scenarios, run:`);
  console.log(`   npx tsx tools/generateMockFuelData.ts normal`);
  console.log(`   npx tsx tools/generateMockFuelData.ts pitstop`);
  console.log(`   npx tsx tools/generateMockFuelData.ts yellow`);
  console.log(`   npx tsx tools/generateMockFuelData.ts saving`);
}

main().catch(console.error);
