export const getTailwindStyle = (
  color?: number,
  highlightColor?: number,
  isMultiClass = false
): {
  driverIcon: string;
  classHeader: string;
  fill: string;
  canvasFill: string;
} => {
  if (color === 0 || !isMultiClass) {
    color = highlightColor;
  }

  const hex = color !== undefined ? `#${(color).toString(16).padStart(6, '0')}` : 0;

  const classColorMap: Record<
    string,
    {
      driverIcon: string;
      classHeader: string;
      fill: string;
      canvasFill: string;
    }
  > = {
    '#ffda59': {
      driverIcon: 'bg-yellow-800 border-yellow-500',
      classHeader: 'bg-yellow-500 border-yellow-500',
      fill: 'fill-yellow-500',
      canvasFill: getColor('yellow'),
    },
    '#f97316': {
      driverIcon: 'bg-orange-800 border-orange-500',
      classHeader: 'bg-orange-500 border-orange-500',
      fill: 'fill-orange-500',
      canvasFill: getColor('orange'),
    },
    '#33ceff': {
      driverIcon: 'bg-blue-800 border-blue-500',
      classHeader: 'bg-blue-500 border-blue-500',
      fill: 'fill-blue-500',
      canvasFill: getColor('blue'),
    },
    '#ff5888': {
      driverIcon: 'bg-pink-800 border-pink-500',
      classHeader: 'bg-pink-500 border-pink-500',
      fill: 'fill-pink-500',
      canvasFill: getColor('pink'),
    },
    '#ae6bff': {
      driverIcon: 'bg-purple-800 border-purple-500',
      classHeader: 'bg-purple-500 border-purple-500',
      fill: 'fill-purple-500',
      canvasFill: getColor('purple'),
    },
    '#ef4444': {
      driverIcon: 'bg-red-800 border-red-500',
      classHeader: 'bg-red-500 border-red-500',
      fill: 'fill-red-500',
      canvasFill: getColor('red'),
    },
    '#f59e0b': {
      driverIcon: 'bg-amber-800 border-amber-500',
      classHeader: 'bg-amber-500 border-amber-500',
      fill: 'fill-amber-500',
      canvasFill: getColor('amber'),
    },
    '#eab308': {
      driverIcon: 'bg-yellow-800 border-yellow-500',
      classHeader: 'bg-yellow-500 border-yellow-500',
      fill: 'fill-yellow-500',
      canvasFill: getColor('yellow'),
    },
    '#84cc16': {
      driverIcon: 'bg-lime-800 border-lime-500',
      classHeader: 'bg-lime-500 border-lime-500',
      fill: 'fill-lime-500',
      canvasFill: getColor('lime'),
    },
    '#22c55e': {
      driverIcon: 'bg-green-800 border-green-500',
      classHeader: 'bg-green-500 border-green-500',
      fill: 'fill-green-500',
      canvasFill: getColor('green'),
    },
    '#10b981': {
      driverIcon: 'bg-emerald-800 border-emerald-500',
      classHeader: 'bg-emerald-500 border-emerald-500',
      fill: 'fill-emerald-500',
      canvasFill: getColor('emerald'),
    },
    '#14b8a6': {
      driverIcon: 'bg-teal-800 border-teal-500',
      classHeader: 'bg-teal-500 border-teal-500',
      fill: 'fill-teal-500',
      canvasFill: getColor('teal'),
    },
    '#06b6d4': {
      driverIcon: 'bg-cyan-800 border-cyan-500',
      classHeader: 'bg-cyan-500 border-cyan-500',
      fill: 'fill-cyan-500',
      canvasFill: getColor('cyan'),
    },
    '#6366f1': {
      driverIcon: 'bg-indigo-800 border-indigo-500',
      classHeader: 'bg-indigo-500 border-indigo-500',
      fill: 'fill-indigo-500',
      canvasFill: getColor('indigo'),
    },
    '#8b5cf6': {
      driverIcon: 'bg-violet-800 border-violet-500',
      classHeader: 'bg-violet-500 border-violet-500',
      fill: 'fill-violet-500',
      canvasFill: getColor('violet'),
    },
    '#d946ef': {
      driverIcon: 'bg-fuchsia-800 border-fuchsia-500',
      classHeader: 'bg-fuchsia-500 border-fuchsia-500',
      fill: 'fill-fuchsia-500',
      canvasFill: getColor('fuchsia'),
    },
    '#f43f5e': {
      driverIcon: 'bg-rose-800 border-rose-500',
      classHeader: 'bg-rose-500 border-rose-500',
      fill: 'fill-rose-500',
      canvasFill: getColor('rose'),
    },
    '#71717a': {
      driverIcon: 'bg-zinc-800 border-zinc-500',
      classHeader: 'bg-zinc-500 border-zinc-500',
      fill: 'fill-zinc-500',
      canvasFill: getColor('zinc'),
    },
    '#78716c': {
      driverIcon: 'bg-stone-800 border-stone-500',
      classHeader: 'bg-stone-500 border-stone-500',
      fill: 'fill-stone-500',
      canvasFill: getColor('stone'),
    }
,    '#0ea5e9': {
      driverIcon: 'bg-sky-800 border-sky-500',
      classHeader: 'bg-sky-500 border-sky-500',
      fill: 'fill-sky-500',
      canvasFill: getColor('sky'),
    },
  };

  return classColorMap[hex] ?? classColorMap['#ffffff'] ?? {
    driverIcon: 'bg-sky-800 border-sky-500',
    classHeader: 'bg-sky-500 border-sky-500',
    fill: 'fill-sky-500',
    canvasFill: getColor('sky')
  };
};

export const getColor = (color?: string, value = 500) => {
  const styles = getComputedStyle(document.documentElement);
  const computedColor = styles.getPropertyValue(`--color-${color}-${value}`);
  return computedColor;
};
