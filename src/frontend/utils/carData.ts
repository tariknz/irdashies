/**
 * Car tachometer data utilities
 * 
 * Data sourced from lovely-car-data repository:
 * https://github.com/Lovely-Sim-Racing/lovely-car-data
 * 
 * This project provides comprehensive car telemetry data for various racing games,
 * including RPM thresholds, LED configurations, and shift point information.
 */

export interface CarData {
  carName: string;
  carId: string;
  carClass: string;
  ledNumber: number;
  redlineBlinkInterval: number;
  ledColor: string[];
  ledRpm: Record<string, number[]>[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
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
 * Cache TTL: 7 days in milliseconds
 * Car data rarely changes in iRacing once added to lovely-car-data
 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Gets a value from cache if it exists and hasn't expired
 * @param key Cache key
 * @returns Cached value or null if expired/missing
 */
const getFromCache = <T,>(key: string): T | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    
    if (now - entry.timestamp > CACHE_TTL_MS) {
      // Cache expired, remove it
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch {
    // Ignore cache errors and fall through to fresh fetch
    return null;
  }
};

/**
 * Stores a value in cache with timestamp
 * @param key Cache key
 * @param data Value to cache
 */
const setInCache = <T,>(key: string, data: T): void => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore cache errors - fall back to always fetching
  }
};

/**
 * Loads car-specific tachometer data from lovely-car-data
 * Caches results for 7 days to avoid GitHub API rate limiting
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
      const cacheKey = `car-data:${gameFolder}:${carId}`;
      
      // Check cache first
      const cached = getFromCache<CarData>(cacheKey);
      if (cached) {
        return cached;
      }
      
      const url = `https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/${gameFolder}/${encodeURIComponent(carId)}.json`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data: CarData = await response.json();
        setInCache(cacheKey, data);
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

/**
 * Fetches the list of available cars from lovely-car-data GitHub repository
 * Caches the list for 7 days to avoid GitHub API rate limiting
 * @param gameFolder The game folder name (e.g., 'IRacing')
 * @returns Promise with array of file objects
 */
export const fetchCarList = async (gameFolder: string): Promise<{ name: string; path: string }[]> => {
  const cacheKey = `car-list:${gameFolder}`;
  
  // Check cache first
  const cached = getFromCache<{ name: string; path: string }[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const response = await fetch(`https://api.github.com/repos/Lovely-Sim-Racing/lovely-car-data/contents/data/${gameFolder}`);
  
  if (!response.ok) {
    if (response.status === 403) {
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : 'unknown';
      throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const files = await response.json();
  setInCache(cacheKey, files);
  return files;
};