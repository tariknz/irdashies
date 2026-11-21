import path from 'node:path';
import { LMU_TIERED_RANKS } from '../src/types/lmu/rating.ts';

const BASE = 'https://rf2-ui-images-prod.s3.eu-west-1.amazonaws.com';

/** `dr` is the driver rating, `sr` the safety rating. */
const KINDS = ['dr', 'sr'] as const;

/** Tier 0 exists in the bucket and stands for a rank carrying no tier. */
const TIERS = [0, 1, 2, 3] as const;
const BADGES = [
  'sr-noob',
  'sr-saint',
  'sr-clean',
  'sr-warning',
  'sr-probation',
] as const;

export const CACHE_DIR = path.resolve('tools/.cache/lmu-rank-art');
const RANK_DIR = path.join(CACHE_DIR, 'drsr');
const BADGE_DIR = path.join(CACHE_DIR, 'badges');

export const plates = KINDS.flatMap((kind) =>
  LMU_TIERED_RANKS.flatMap((rank) =>
    TIERS.map((tier) => ({
      name: `${kind}-${rank}${tier}`,
      url: `${BASE}/ranks/${kind}-lmu/${rank}${tier}-small.svg`,
      file: path.join(RANK_DIR, `${kind}-${rank}${tier}.svg`),
    }))
  )
);

export const badges = BADGES.map((name) => ({
  name,
  url: `${BASE}/badges/${name}.svg`,
  file: path.join(BADGE_DIR, `${name}.svg`),
}));
