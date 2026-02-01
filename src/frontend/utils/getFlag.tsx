import { GlobalFlags } from '@irdashies/types';
export const getFlag = (sessionFlags: number) => {
/**
Flag Priority Hierarchy:
BLACK FLAG / FURLED 
CHECKERED 
RED 
DISQUALIFIED 
MEATBALL (Only if both Servicible and Repair bits are set)
YELLOW (Includes Waving, Caution, and CautionWaving)
GREEN 
BLUE FLAG 
DEBRIS (Track surface hazard)
WHITE (Final lap)
NO FLAG
*/

  // 1. ABSOLUTE PRIORITY Too important in iracing to put any other flag above it
  if (sessionFlags & (GlobalFlags.Black | GlobalFlags.Furled)) {
    return { label: 'BLACK FLAG', color: 'bg-black text-white' };
  }

  // 2. CRITICAL SESSION STATUS
  if (sessionFlags & GlobalFlags.Checkered) return { label: 'CHECKERED', color: 'bg-white text-black' };
  if (sessionFlags & GlobalFlags.Red) return { label: 'RED', color: 'bg-red-600' };
  if (sessionFlags & GlobalFlags.Disqualify) return { label: 'DISQUALIFIED', color: 'bg-black text-red-600' };

  // 3. MECHANICAL / MEATBALL 
  const meatballMask = GlobalFlags.Servicible | GlobalFlags.Repair;
  if ((sessionFlags & meatballMask) === meatballMask) {
    return { label: 'MEATBALL', color: 'bg-orange-600' };
  }

  // 4. TRACK CAUTIONS
  if (sessionFlags & (GlobalFlags.Yellow | GlobalFlags.YellowWaving | GlobalFlags.Caution | GlobalFlags.CautionWaving)) {
    return { label: 'YELLOW', color: 'bg-yellow-400 text-black' };
  }

  // 5. RACING STATE
  if (sessionFlags & (GlobalFlags.Green | GlobalFlags.StartGo)) {
    return { label: 'GREEN', color: 'bg-green-600' };
  }

  // 6. INFO FLAGS
  if (sessionFlags & GlobalFlags.Blue) return { label: 'BLUE FLAG', color: 'bg-blue-600' };
  if (sessionFlags & GlobalFlags.Debris) return { label: 'DEBRIS', color: 'bg-yellow-400' };
  if (sessionFlags & GlobalFlags.White) return { label: 'WHITE', color: 'bg-white text-black' };
  
  return { label: 'NO FLAG', color: 'bg-slate-500' };
};