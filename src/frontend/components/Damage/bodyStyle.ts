export type DamageBodyStyle =
  | 'gtFront'
  | 'gtMid'
  | 'gtRear'
  | 'prototype'
  | 'openwheel'
  | 'hatch'
  | 'stock'
  | 'truck';

const OPEN_WHEEL = new Set([
  'f1',
  'f2',
  'f20',
  'f2.0',
  'f3',
  'f3.5',
  'f4',
  'f1.6',
  'fvee',
  'indy',
  'nxt',
  'usf',
  'sf',
  'sfl',
  'ir01',
]);

const PROTOTYPE = new Set([
  'gtp',
  'lmp1',
  'lmp2',
  'lmp3',
  'hyp',
  'hyp2026',
  'dpi',
]);

const HATCH = new Set([
  'mx5',
  'gr86',
  'tcr',
  'm2',
  'm2c',
  'cat',
  'clio',
  'scca',
]);

const STOCK = new Set(['gen4', 'nxg', 'enas', 'cts', 'sup', 'mini']);

const STOCK_CAR_PATHS = ['stockcars', 'euronascar'];

const TRUCK = new Set(['ore', 'pro2', 'truck']);

const GT = new Set([
  'gt3',
  'gt4',
  'gte',
  'gt1',
  'gt3 2026',
  'f296',
  'sr8',
  'sr10',
]);

function normalizeClass(carClass: string | undefined): string {
  return (carClass ?? '').trim().toLowerCase();
}

function haystack(
  carPath: string | undefined,
  carClass: string | undefined,
  carName: string | undefined
): string {
  return [carPath, carClass, carName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function resolveGtLayout(h: string): 'gtFront' | 'gtMid' | 'gtRear' {
  if (/\brsr\b|991rsr/.test(h)) return 'gtMid';

  if (
    /\b(911|992|991|993|996|997)\b/.test(h) ||
    (/porsche/.test(h) && !/718|cayman|963|919|gtp|lmp/.test(h))
  ) {
    return 'gtRear';
  }

  if (
    /ferrari|mclaren|lamborghini|huracan|cayman|fordgt|\b(296|488|720|570|mp4|lambo|audi|r8|nsx|c8|c8r|z06|718)\b|audir8/.test(
      h
    )
  ) {
    return 'gtMid';
  }

  if (
    /bmw|mercedes|mustang|vantage|dbr9|corvette|\b(m4|m8|amg|c6|c6r)\b/.test(h)
  ) {
    return 'gtFront';
  }

  return 'gtMid';
}

export function resolveDamageBodyStyle(
  carPath?: string,
  carClass?: string,
  carName?: string
): DamageBodyStyle {
  const path = (carPath ?? '').trim().toLowerCase();
  if (STOCK_CAR_PATHS.some((prefix) => path.startsWith(prefix))) return 'stock';
  const cls = normalizeClass(carClass);
  const h = haystack(carPath, carClass, carName);

  if (OPEN_WHEEL.has(cls)) return 'openwheel';
  if (PROTOTYPE.has(cls) || cls.startsWith('lmp') || cls.startsWith('hyp'))
    return 'prototype';
  if (TRUCK.has(cls)) return 'truck';
  if (STOCK.has(cls)) return 'stock';
  if (HATCH.has(cls)) return 'hatch';
  if (GT.has(cls) || cls.startsWith('gt')) return resolveGtLayout(h);

  if (
    /\b(formula|open.?wheel|indycar|usf|ray.?ff|ff1600|fvee|skip.?barber)\b/.test(
      h
    ) ||
    /\bf[1-4]\b/.test(h)
  ) {
    return 'openwheel';
  }
  if (
    /\b(lmp|hypercar|gtp|daytona.?proto|dpi|lmh|lmdh|499p|963|valkyrie|a424)\b/.test(
      h
    )
  ) {
    return 'prototype';
  }
  if (/\b(truck|pro.?2|off.?road|late.?model)\b/.test(h)) return 'truck';
  if (/\b(gen.?4|nascar|stock.?car|legends|mini.?stock)\b/.test(h)) {
    return 'stock';
  }
  if (/\b(mx.?5|miata|gr86|clio|tcr|tour.?2|m2|caterham|gr.?86)\b/.test(h)) {
    return 'hatch';
  }
  return resolveGtLayout(h);
}
