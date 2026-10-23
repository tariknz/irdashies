import type { LmuBadgeFormat, LmuDriverRating } from '@irdashies/types';
import { LmuRatingBadge } from '../../shared/DriverRatingBadge/LmuRatingBadge';

/**
 * One LMU rating format, drawn by the component that draws it for real.
 *
 * Deliberately not a hand-built mock-up like BadgeFormatPreview, which
 * reproduces each iRacing format in markup and so can drift from the badge it
 * is previewing. Here the preview *is* LmuRatingBadge, so what the settings
 * page shows cannot disagree with what a standings row shows.
 *
 * The sample is a Gold 3 driver rating beside a Silver 2 safety rating, so the
 * two differ in both rank and colour and every option is distinguishable from
 * the others at a glance.
 */
const SAMPLE: LmuDriverRating = {
  driverRank: 'Gold',
  driverTier: 3,
  safetyRank: 'Silver',
  safetyTier: 2,
};

export const LmuBadgeFormatPreview = ({
  format,
}: {
  format: LmuBadgeFormat;
}) => <LmuRatingBadge rating={SAMPLE} format={format} />;
