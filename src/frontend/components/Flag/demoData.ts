// Demo data for Flag component
export interface FlagDemoData {
  label: string;
  color: string;
  textColor: string;
}

export const getDemoFlagData = (): FlagDemoData => {
  // You can manually change this string to 'NO FLAG', 'BLUE', 'RED', 'BLACK', or 'CHECKERED' to test other styles
  const activeDemo: 'NO FLAG' | 'YELLOW' | 'BLUE' | 'RED' | 'BLACK' | 'CHECKERED' = 'NO FLAG';

  const demoMap: Record<string, FlagDemoData> = {
    'NO FLAG': {
      label: 'NO FLAG',
      color: 'bg-slate-500',
      textColor: 'text-slate-500',
    },
    YELLOW: {
      label: 'YELLOW',
      color: 'bg-yellow-400',
      textColor: 'text-black',
    },
    BLUE: {
      label: 'BLUE',
      color: 'bg-blue-600',
      textColor: 'text-white',
    },
    RED: {
      label: 'RED',
      color: 'bg-red-600',
      textColor: 'text-white',
    },
    BLACK: {
      label: 'BLACK',
      color: 'bg-black',
      textColor: 'text-white',
    },
    CHECKERED: {
      label: 'CHECKERED',
      color: 'bg-white',
      textColor: 'text-black',
    }
  };

  return demoMap[activeDemo];
};