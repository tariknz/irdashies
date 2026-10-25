import type {
  BroadcastConfig,
  BroadcastPage,
  BroadcastTransition,
} from '@irdashies/types';

export const ROW_HEIGHT = 24;

/**
 * What the right-hand column of the tower shows right now. Gaps without a
 * class are the intervals of every class at once, for a static tower.
 */
export type Page =
  | { kind: 'names' }
  | { kind: 'gaps'; classId?: string; className?: string }
  | { kind: 'gained' }
  | { kind: 'pits' }
  | { kind: 'tyres' };

/** What the session can fill right now; other pages are left out. */
interface PageData {
  classes: [classId: string, className: string][];
  hasGained: boolean;
  hasPits: boolean;
  hasTyreChoice: boolean;
}

/**
 * The tower pages: the one static page, or the rotation the user picked,
 * minus pages with nothing to show yet. Never empty: names is the fallback.
 */
export const buildPages = (
  config: Partial<
    Pick<BroadcastConfig, 'pageMode' | 'pages' | 'staticPage'>
  > = {},
  data: PageData
): Page[] => {
  if (config.pageMode === 'static') {
    const kind: BroadcastPage = config.staticPage ?? 'gaps';
    return [kind === 'gaps' ? { kind: 'gaps' } : { kind }];
  }
  const on = (kind: BroadcastPage) => config.pages?.[kind] !== false;
  const pages: Page[] = [
    ...(on('names') ? [{ kind: 'names' } as const] : []),
    ...(on('gaps')
      ? data.classes.map(([classId, className]): Page => ({
          kind: 'gaps',
          classId,
          className,
        }))
      : []),
    ...(on('gained') && data.hasGained ? [{ kind: 'gained' } as const] : []),
    ...(on('pits') && data.hasPits ? [{ kind: 'pits' } as const] : []),
    ...(on('tyres') && data.hasTyreChoice ? [{ kind: 'tyres' } as const] : []),
  ];
  return pages.length ? pages : [{ kind: 'names' }];
};

/** Header label for the pages that show the same column for every class. */
export const PAGE_LABELS: Partial<Record<Page['kind'], string>> = {
  gained: '+/- Start',
  pits: 'Last Pit',
  tyres: 'Tyres',
};

export const TRANSITIONS = [
  'slide-left',
  'slide-right',
  'slide-up',
  'fade-in',
  'flip',
  'wipe',
  'zoom',
  'checker',
] as const satisfies readonly Exclude<BroadcastTransition, 'random'>[];
export type Transition = (typeof TRANSITIONS)[number];

/**
 * The transition for the next page flip. A fixed choice is used every time;
 * random (or anything unrecognised in the saved config) never repeats the
 * last one, so two page flips never look alike.
 */
export const pickTransition = (
  mode: string | undefined,
  last?: Transition
): Transition => {
  const fixed = TRANSITIONS.find((t) => t === mode);
  if (fixed) return fixed;
  const options = TRANSITIONS.filter((t) => t !== last);
  return options[Math.floor(Math.random() * options.length)];
};

/** Rows enter one after another, top to bottom. */
export const rowAnimation = (effect: Transition | undefined, index: number) =>
  effect && effect !== 'checker'
    ? { animation: `broadcast-${effect} 450ms ease-out ${index * 35}ms both` }
    : undefined;
