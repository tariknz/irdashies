import type { LmuRawSession } from '../native/lmu';

export const lmuSessionSignature = (session: LmuRawSession): string =>
  `${session.trackName}:${session.session}:${session.numVehicles}:${
    session.playerHasVehicle ? session.playerVehicleIdx : -1
  }|${session.drivers
    .map(
      (driver) =>
        `${driver.id}:${driver.name}:${driver.vehicleName}:${driver.className}`
    )
    .join('|')}`;
