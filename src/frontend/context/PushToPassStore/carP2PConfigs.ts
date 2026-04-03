export interface CarP2PConfig {
  carId: number;
  /** Total available Push to Pass time in seconds */
  maxValue: number;
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
  { carId: 97, maxValue: 200, cooldownInterval: 10 },
  // Dallara F3
  { carId: 116, maxValue: 200, cooldownInterval: 10 },
];

export const getCarP2PConfig = (carId: number): CarP2PConfig | undefined =>
  CAR_P2P_CONFIGS.find((c) => c.carId === carId);
