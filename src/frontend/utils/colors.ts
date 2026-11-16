import {
  CLASS_COLOURS_FASTEST_FIRST,
  LMU_CLASS_COLOURS,
} from '@irdashies/types';

export interface TailwindStyles {
  driverIcon: string;
  classHeader: string;
  fill: string;
  canvasFill: string;
  borderColor: string;
}

// Class colour integers to colour names, fastest tier first. Built from the
// shared ordered palette so a sim-side mapper assigning colours by speed rank
// and this lookup cannot disagree about which integer means which tier.
const CLASS_COLOUR_NAMES_FASTEST_FIRST = [
  'yellow',
  'blue',
  'red',
  'cyan',
  'pink',
  'purple',
  'amber',
  'lime',
] as const;

const IRACING_CLASS_COLOR_MAP: Record<number, string> = Object.fromEntries(
  CLASS_COLOURS_FASTEST_FIRST.map((colour, rank) => [
    colour,
    CLASS_COLOUR_NAMES_FASTEST_FIRST[rank],
  ])
);

// Color names to hex values for classColorMap lookup
const COLOR_NAME_TO_HEX: Record<string, string> = {
  yellow: '#ffda59',
  blue: '#33ceff',
  red: '#ef4444',
  cyan: '#06b6d4',
  pink: '#ff5888',
  purple: '#ae6bff',
  lime: '#84cc16',
  amber: '#f59e0b',
};

// LMU's class colours are exact values rather than Tailwind palette members,
// so they are keyed straight to their own hex. Without this they would miss
// the iRacing lookup above and every LMU class would render stone.
const LMU_CLASS_COLOR_HEX: Record<number, string> = Object.fromEntries(
  Object.values(LMU_CLASS_COLOURS).map((colour) => [
    colour,
    `#${colour.toString(16).padStart(6, '0')}`,
  ])
);

type ColorStyleDefinition = Omit<TailwindStyles, 'canvasFill'> & {
  /** A theme colour token, or an exact hex value for LMU. */
  canvasColor: string;
};

// Keep static classes here; resolve only the selected colour against the live
// theme. Eagerly resolving the whole table creates 20 CSSStyleDeclaration
// objects per lookup, even when the caller only needs a class name.
const CLASS_COLOR_STYLES: Record<string, ColorStyleDefinition> = {
  // Le Mans Ultimate class liveries. Exact values, so these use arbitrary
  // Tailwind colours rather than palette names; the icon background is the
  // same hue held back to 30% so the border still reads against it.
  '#ff000a': {
    // Hypercar
    driverIcon: 'bg-[#ff000a]/30 border-[#ff000a]',
    classHeader: 'bg-[#ff000a] border-[#ff000a]',
    fill: 'fill-[#ff000a]',
    canvasColor: '#ff000a',
    borderColor: 'border-[#ff000a]',
  },
  '#0690ff': {
    // LMP2
    driverIcon: 'bg-[#0690ff]/30 border-[#0690ff]',
    classHeader: 'bg-[#0690ff] border-[#0690ff]',
    fill: 'fill-[#0690ff]',
    canvasColor: '#0690ff',
    borderColor: 'border-[#0690ff]',
  },
  '#763993': {
    // LMP3
    driverIcon: 'bg-[#763993]/30 border-[#763993]',
    classHeader: 'bg-[#763993] border-[#763993]',
    fill: 'fill-[#763993]',
    canvasColor: '#763993',
    borderColor: 'border-[#763993]',
  },
  '#00ff6a': {
    // LMGT3
    driverIcon: 'bg-[#00ff6a]/30 border-[#00ff6a]',
    classHeader: 'bg-[#00ff6a] border-[#00ff6a]',
    fill: 'fill-[#00ff6a]',
    canvasColor: '#00ff6a',
    borderColor: 'border-[#00ff6a]',
  },
  '#fff600': {
    // LMGTE
    driverIcon: 'bg-[#fff600]/30 border-[#fff600]',
    classHeader: 'bg-[#fff600] border-[#fff600]',
    fill: 'fill-[#fff600]',
    canvasColor: '#fff600',
    borderColor: 'border-[#fff600]',
  },
  '#ffda59': {
    driverIcon: 'bg-yellow-800 border-yellow-500',
    classHeader: 'bg-yellow-500 border-yellow-500',
    fill: 'fill-yellow-500',
    canvasColor: 'yellow',
    borderColor: 'border-yellow-500',
  },
  '#f97316': {
    driverIcon: 'bg-orange-800 border-orange-500',
    classHeader: 'bg-orange-500 border-orange-500',
    fill: 'fill-orange-500',
    canvasColor: 'orange',
    borderColor: 'border-orange-500',
  },
  '#33ceff': {
    driverIcon: 'bg-blue-800 border-blue-500',
    classHeader: 'bg-blue-500 border-blue-500',
    fill: 'fill-blue-500',
    canvasColor: 'blue',
    borderColor: 'border-blue-500',
  },
  '#ff5888': {
    driverIcon: 'bg-pink-800 border-pink-500',
    classHeader: 'bg-pink-500 border-pink-500',
    fill: 'fill-pink-500',
    canvasColor: 'pink',
    borderColor: 'border-pink-500',
  },
  '#ae6bff': {
    driverIcon: 'bg-purple-800 border-purple-500',
    classHeader: 'bg-purple-500 border-purple-500',
    fill: 'fill-purple-500',
    canvasColor: 'purple',
    borderColor: 'border-purple-500',
  },
  '#ef4444': {
    driverIcon: 'bg-red-800 border-red-500',
    classHeader: 'bg-red-500 border-red-500',
    fill: 'fill-red-500',
    canvasColor: 'red',
    borderColor: 'border-red-500',
  },
  '#f59e0b': {
    driverIcon: 'bg-amber-800 border-amber-500',
    classHeader: 'bg-amber-500 border-amber-500',
    fill: 'fill-amber-500',
    canvasColor: 'amber',
    borderColor: 'border-amber-500',
  },
  '#eab308': {
    driverIcon: 'bg-yellow-800 border-yellow-500',
    classHeader: 'bg-yellow-500 border-yellow-500',
    fill: 'fill-yellow-500',
    canvasColor: 'yellow',
    borderColor: 'border-yellow-500',
  },
  '#84cc16': {
    driverIcon: 'bg-lime-800 border-lime-500',
    classHeader: 'bg-lime-500 border-lime-500',
    fill: 'fill-lime-500',
    canvasColor: 'lime',
    borderColor: 'border-lime-500',
  },
  '#22c55e': {
    driverIcon: 'bg-green-800 border-green-500',
    classHeader: 'bg-green-500 border-green-500',
    fill: 'fill-green-500',
    canvasColor: 'green',
    borderColor: 'border-green-500',
  },
  '#10b981': {
    driverIcon: 'bg-emerald-800 border-emerald-500',
    classHeader: 'bg-emerald-500 border-emerald-500',
    fill: 'fill-emerald-500',
    canvasColor: 'emerald',
    borderColor: 'border-emerald-500',
  },
  '#14b8a6': {
    driverIcon: 'bg-teal-800 border-teal-500',
    classHeader: 'bg-teal-500 border-teal-500',
    fill: 'fill-teal-500',
    canvasColor: 'teal',
    borderColor: 'border-teal-500',
  },
  '#06b6d4': {
    driverIcon: 'bg-cyan-800 border-cyan-500',
    classHeader: 'bg-cyan-500 border-cyan-500',
    fill: 'fill-cyan-500',
    canvasColor: 'cyan',
    borderColor: 'border-cyan-500',
  },
  '#6366f1': {
    driverIcon: 'bg-indigo-800 border-indigo-500',
    classHeader: 'bg-indigo-500 border-indigo-500',
    fill: 'fill-indigo-500',
    canvasColor: 'indigo',
    borderColor: 'border-indigo-500',
  },
  '#8b5cf6': {
    driverIcon: 'bg-violet-800 border-violet-500',
    classHeader: 'bg-violet-500 border-violet-500',
    fill: 'fill-violet-500',
    canvasColor: 'violet',
    borderColor: 'border-violet-500',
  },
  '#d946ef': {
    driverIcon: 'bg-fuchsia-800 border-fuchsia-500',
    classHeader: 'bg-fuchsia-500 border-fuchsia-500',
    fill: 'fill-fuchsia-500',
    canvasColor: 'fuchsia',
    borderColor: 'border-fuchsia-500',
  },
  '#f43f5e': {
    driverIcon: 'bg-rose-800 border-rose-500',
    classHeader: 'bg-rose-500 border-rose-500',
    fill: 'fill-rose-500',
    canvasColor: 'rose',
    borderColor: 'border-rose-500',
  },
  '#71717a': {
    driverIcon: 'bg-zinc-800 border-zinc-500',
    classHeader: 'bg-zinc-500 border-zinc-500',
    fill: 'fill-zinc-500',
    canvasColor: 'zinc',
    borderColor: 'border-zinc-500',
  },
  '#78716c': {
    driverIcon: 'bg-stone-800 border-stone-500',
    classHeader: 'bg-stone-500 border-stone-500',
    fill: 'fill-stone-500',
    canvasColor: 'stone',
    borderColor: 'border-stone-500',
  },
  '#0ea5e9': {
    driverIcon: 'bg-sky-800 border-sky-500',
    classHeader: 'bg-sky-500 border-sky-500',
    fill: 'fill-sky-500',
    canvasColor: 'sky',
    borderColor: 'border-sky-500',
  },
};

export const getTailwindStyle = (
  color?: number,
  highlightColor?: number,
  isMultiClass = false
): TailwindStyles => {
  let hex: string | undefined;

  if (isMultiClass && color !== undefined) {
    const colorName = IRACING_CLASS_COLOR_MAP[color];
    if (colorName) {
      hex = COLOR_NAME_TO_HEX[colorName];
    } else {
      hex = LMU_CLASS_COLOR_HEX[color] ?? '#78716c'; // stone if unmapped
    }
  } else if (highlightColor !== undefined) {
    hex = `#${highlightColor.toString(16).padStart(6, '0')}`;
  }
  const style = CLASS_COLOR_STYLES[hex ?? ''] ?? CLASS_COLOR_STYLES['#0ea5e9'];
  return {
    driverIcon: style.driverIcon,
    classHeader: style.classHeader,
    fill: style.fill,
    borderColor: style.borderColor,
    canvasFill: style.canvasColor.startsWith('#')
      ? style.canvasColor
      : getColor(style.canvasColor),
  };
};

export const colorNumToHex = (color?: number): string | undefined => {
  if (color == null) return undefined;
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
};

let rootColorStyle:
  | {
      root: Element;
      getStyle: typeof getComputedStyle;
      style: CSSStyleDeclaration;
    }
  | undefined;

export const getColor = (color?: string, value = 500) => {
  const root = document.documentElement;
  if (
    rootColorStyle?.root !== root ||
    rootColorStyle.getStyle !== getComputedStyle
  ) {
    rootColorStyle = {
      root,
      getStyle: getComputedStyle,
      style: getComputedStyle(root),
    };
  }
  // Computed style declarations are live: keep reading the current property,
  // while reusing one declaration instead of allocating one for every car/frame.
  return rootColorStyle.style.getPropertyValue(`--color-${color}-${value}`);
};
