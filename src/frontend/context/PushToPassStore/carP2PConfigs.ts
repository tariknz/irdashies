export interface CarP2PConfig {
  carId: number;
  /** Cooldown interval in seconds after deactivation before P2P can be reactivated */
  cooldownInterval: number;
}

/**
 * Per-car Push to Pass configuration.
 * carId corresponds to CarID from iRacing session data (driver.CarID).
 * Verify carId values against actual iRacing session data for your cars.
 */
export const CAR_P2P_CONFIGS: CarP2PConfig[] = [
  // Dallara IR18 (IndyCar)
  { carId: 99, cooldownInterval: 10 },
  // Dallara F3
  { carId: 106, cooldownInterval: 10 },
  // Super Formula - Toyota
  { carId: 171, cooldownInterval: 100 },
  // Super Formula - Honda
  { carId: 172, cooldownInterval: 100 },
  // IL-15
  { carId: 205, cooldownInterval: 0 },
];

export const getCarP2PConfig = (carId: number): CarP2PConfig | undefined =>
  CAR_P2P_CONFIGS.find((c) => c.carId === carId);
