/**
 * Re-export, so this widget and the Lap Trace cannot disagree about the track.
 *
 * There used to be two near-identical copies of this hook: this one and the
 * shared one the Lap Trace imports. They drifted into being the same bug twice
 * -- the Lovely lookup cannot serve LMU, whose track names never match its
 * iRacing slugs -- and fixing one would have left the other showing another
 * circuit's corners.
 */
export { useLovelyTrackData } from '@irdashies/context';
