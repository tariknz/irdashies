export interface CarData {
  carName: string;
  carId: string;
  carClass: string;
  ledNumber: number;
  redlineBlinkInterval: number;
  ledColor: string[];
  ledRpm: Record<string, number[]>[];
}

/**
 * Maps game identifiers to lovely-car-data folder names
 */
const GAME_FOLDER_MAP: Record<string, string> = {
  'iracing': 'IRacing',
  'assettocorsa': 'AssettoCorsa', 
  'assettocorsacompetizione': 'AssettoCorsaCompetizione',
  'automobilista2': 'Automobilista2',
  'f12024': 'F12024',
  'f12025': 'F12025', 
  'lmu': 'LMU',
  'rrre': 'RRRE'
};

/**
 * Loads car-specific tachometer data from lovely-car-data
 * @param carPath The car path from the game
 * @param gameId The current game identifier (optional, defaults to 'iracing')
 * @returns Promise<CarData | null>
 */
export const loadCarData = async (carPath: string, gameId = 'iracing'): Promise<CarData | null> => {
  try {
    // Get the appropriate folder for the game
    const gameFolder = GAME_FOLDER_MAP[gameId.toLowerCase()] || 'IRacing';
    
    // Try multiple variations of the car ID
    const carIdVariations = [
      carPath.toLowerCase(), // Original with spaces/special chars
      carPath.toLowerCase().replace(/[^a-z0-9]/g, ''), // Remove all non-alphanumeric
      carPath.toLowerCase().replace(/[^a-z0-9 ]/g, '') // Keep spaces, remove other special chars
    ];
    
    // Try each variation
    for (const carId of carIdVariations) {
      const url = `https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/${gameFolder}/${encodeURIComponent(carId)}.json`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data: CarData = await response.json();
        return data;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load car data:', error);
    return null;
  }
};

/**
 * Gets the appropriate gear key for the car data
 * @param gear Current gear number
 * @returns Gear key string
 */
export const getGearKey = (gear: number): string => {
  if (gear === 0) return 'N';
  if (gear === -1) return 'R';
  return gear.toString();
};