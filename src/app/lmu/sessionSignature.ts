import type { LmuRawSession } from './native';

export const lmuSessionSignature = (session: LmuRawSession): string =>
  JSON.stringify({
    trackName: session.trackName,
    session: session.session,
    numVehicles: session.numVehicles,
    playerVehicleIdx: session.playerHasVehicle ? session.playerVehicleIdx : -1,
    lapDist: session.lapDist,
    gameVersion: session.gameVersion,
    cloudCoverage: session.cloudCoverage,
    wind: session.wind,
    raining: session.raining,
    maxPlayers: session.maxPlayers,
    maxLaps: session.maxLaps,
    isFixedSetup: session.isFixedSetup,
    engineMaxRPM: session.engineMaxRPM,
    fuelCapacity: session.fuelCapacity,
    maxGears: session.maxGears,
    frontTireCompoundName: session.frontTireCompoundName,
    drivers: session.drivers.map((driver) => ({
      id: driver.id,
      isPlayer: driver.isPlayer,
      name: driver.name,
      vehicleName: driver.vehicleName,
      vehicleModel: driver.vehicleModel,
      className: driver.className,
      vehFilename: driver.vehFilename,
      classId: driver.classId,
      // mapLmuSession derives CarIsAI and CarIsAIControlled from this, and the
      // bridge republishes only when the signature moves -- so an AI takeover
      // on its own left those flags stale until some other tracked field
      // happened to change.
      control: driver.control,
      qualification: driver.qualification,
      // The running order in a race. Without it an overtake changed nothing
      // the signature could see, so the standings held their old order until
      // somebody happened to complete a lap. Places move rarely, so the extra
      // republishes this allows are few.
      place: driver.place,
      bestLapTime: driver.bestLapTime,
      lastLapTime: driver.lastLapTime,
      totalLaps: driver.totalLaps,
      estimatedLapTime: driver.estimatedLapTime,
    })),
  });
