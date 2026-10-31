import {
  HourglassIcon,
  PlantIcon,
  ShieldCheckIcon,
  ShieldStarIcon,
  ShieldWarningIcon,
  type Icon,
} from '@phosphor-icons/react';

export interface LmuBadgeProps {
  /**
   * The marker the rating service reports in `profile.badge`, e.g. `sr-saint`.
   * Opaque: a key into the service's set, not something to interpret.
   */
  badge?: string;
}

interface BadgeStyle {
  icon: Icon;
  label: string;
  /** Border, background and icon colour, as Tailwind classes. */
  className: string;
}

/**
 * The markers the service is known to award, drawn as a chip with a Phosphor
 * icon in the app's own design language rather than with the sim's artwork.
 *
 * `sr-danger` looks the same as `sr-warning`, deliberately: the service
 * reports the two separately and they mean the same thing to a driver.
 */
const BADGES: Record<string, BadgeStyle> = {
  'sr-noob': {
    icon: PlantIcon,
    label: 'New driver',
    className: 'border-sky-400 bg-sky-900 text-sky-300',
  },
  'sr-saint': {
    icon: ShieldStarIcon,
    label: 'Saint',
    className: 'border-amber-300 bg-amber-900 text-amber-300',
  },
  'sr-clean': {
    icon: ShieldCheckIcon,
    label: 'Clean',
    className: 'border-emerald-400 bg-emerald-900 text-emerald-300',
  },
  'sr-warning': {
    icon: ShieldWarningIcon,
    label: 'Warning',
    className: 'border-orange-400 bg-orange-900 text-orange-300',
  },
  'sr-danger': {
    icon: ShieldWarningIcon,
    label: 'Warning',
    className: 'border-orange-400 bg-orange-900 text-orange-300',
  },
  'sr-probation': {
    icon: HourglassIcon,
    label: 'Probation',
    className: 'border-red-400 bg-red-900 text-red-300',
  },
};

/**
 * One LMU achievement badge.
 *
 * Its own column rather than part of LmuRatingBadge, because it answers a
 * different question: the rank pair is where a driver stands, this is a marker
 * they have been given, and either can be wanted without the other.
 *
 * A known marker draws its chip, and an unknown one a short label.
 *
 * The label is deliberately not nothing. A driver the service gave a marker
 * for and a driver it gave none are different facts, and an empty cell says
 * the second while meaning the first -- which is indistinguishable from the
 * column being broken, and cost a long time to tell apart once already. So a
 * marker this list does not know shows its own name, trimmed of the `sr-`
 * prefix: ugly, but never silent. A marker the service adds later needs an
 * entry above.
 */
export const LmuBadge = ({ badge }: LmuBadgeProps) => {
  if (!badge) return null;

  const style = BADGES[badge];
  if (style) {
    const BadgeIcon = style.icon;
    return (
      <span
        role="img"
        aria-label={style.label}
        title={style.label}
        className={`inline-flex shrink-0 items-center justify-center rounded-md border-2 px-0.5 text-xs leading-tight ${style.className}`}
      >
        <BadgeIcon size="1.2em" weight="fill" />
      </span>
    );
  }

  return (
    <span
      title={badge}
      className="text-[0.6em] uppercase tracking-wide text-white/70"
    >
      {badge.replace(/^sr-/, '')}
    </span>
  );
};
