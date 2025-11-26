import { useStore } from 'zustand';
import { useSessionStore } from '../../../../context/SessionStore/SessionStore';

interface CompoundProps {
  carIdx: number;
  tireCompound: number;
  mockTires?: { TireIndex: number; TireCompoundType: string }[];
}

export const Compound = ({
  tireCompound, mockTires, carIdx
}: CompoundProps) => {
  const session = useStore(useSessionStore, (state) => state.session);
  const driverTires = mockTires || session?.DriverInfo?.DriverTires;

  const tireCompoundNameRaw = driverTires?.find(t => t.TireIndex === tireCompound)?.TireCompoundType;
  let tireCompoundName = tireCompoundNameRaw;
  if (driverTires && driverTires.length === 2) {
    const tireTypes = driverTires.map(t => t.TireCompoundType);
    if (tireTypes.includes('Hard') && tireTypes.includes('Wet') && tireCompoundNameRaw === 'Hard') {
      tireCompoundName = 'Dry';
    }
  }
  const tireCompoundColors: Record<string, string> = {
    'Hard': '#ffffff',
    'Primary': '#ffffff',
    'Medium': '#f0d700',
    'Soft': '#d40000',
    'Alternate': '#d40000',
    'Wet': '#078cd1',
    'Dry': '#4d4d4d'
  };
  const fillColor = tireCompoundColors[tireCompoundName ?? ''] || '#4d4d4d'; // default
  if (tireCompound < 0) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className="inline-block w-[1.2em] h-[1.2em] shrink-0"
      width="100%"
      height="100%"
    >
      <circle cx="50" cy="50" r="46" stroke="#cccccc" strokeWidth="6" fill="none" opacity="0.5"/>
      <circle cx="50" cy="50" r="34" stroke="#333333" strokeWidth="20" fill="none"/>
      <circle cx="50" cy="50" r="20" stroke={fillColor} strokeWidth="12" fill="none"/>
      <circle cx="50" cy="50" r="10" stroke="#333333" strokeWidth="8" fill="none"/>
      <circle cx="50" cy="50" r="2" fill="none"/>
    </svg>
  );
};
