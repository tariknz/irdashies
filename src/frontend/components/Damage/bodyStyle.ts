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
  'enas',
]);

const PROTOTYPE = new Set([
  'gtp',
  'lmp1',
  'lmp2',
  'lmp3',
  'hyp',
  'hyp2026',
  'nxg',
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

const STOCK = new Set(['gen4', 'cts', 'cup', 'sup', 'mini']);

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
  // 911 family — rear engine (exclude mid-engine Cayman / prototypes).
  if (
    /\b(911|992|991|993|996|997|rsr)\b/.test(h) ||
    (/\bporsche\b/.test(h) && !/\b(718|cayman|963|919|gtp|lmp)\b/.test(h))
  ) {
    return 'gtRear';
  }

  // Mid-engine GT / GTE.
  if (
    /\b(ferrari|296|488|mclaren|720|570|mp4|lamborghini|huracan|lambo|audi|r8|nsx|c8|z06|718|cayman|fordgt|ford.?gt.?2017)\b/.test(
      h
    )
  ) {
    return 'gtMid';
  }

  // Front-engine GT.
  if (/\b(bmw|m4|m8|mercedes|amg|mustang|vantage|dbr9|c6|corvette)\b/.test(h)) {
    return 'gtFront';
  }

  return 'gtMid';
}

/**
 * Pick a top-down silhouette family from session / lovely-car-data class.
 * GT is split into front / mid / rear engine layouts.
 */
export function resolveDamageBodyStyle(
  carPath?: string,
  carClass?: string,
  carName?: string
): DamageBodyStyle {
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
  if (/\b(mx.?5|miata|gr86|clio|tcr|type.?2|m2|caterham|gr.?86)\b/.test(h)) {
    return 'hatch';
  }
  if (
    /\b(gt3|gt4|gte|gt1|911|296|lambo|mclaren|ferrari|porsche|bmw|mustang)\b/.test(
      h
    )
  ) {
    return resolveGtLayout(h);
  }
  return 'gtMid';
}

export function damageBodyStyleLabel(style: DamageBodyStyle): string {
  switch (style) {
    case 'gtFront':
      return 'GT front-engine';
    case 'gtMid':
      return 'GT mid-engine';
    case 'gtRear':
      return 'GT rear-engine';
    case 'prototype':
      return 'Prototype';
    case 'openwheel':
      return 'Open wheel';
    case 'hatch':
      return 'Street';
    case 'stock':
      return 'Stock car';
    case 'truck':
      return 'Truck';
  }
}
