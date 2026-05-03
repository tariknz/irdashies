import {
  useFocusCarIdx,
  useFocusedDriver,
  useDriverStatsStore,
} from '@irdashies/context';
import type { SessionBarConfig } from '@irdashies/types';
import { DriverRatingBadge } from '../DriverRatingBadge/DriverRatingBadge';

export const DriverBadgeItem = ({
  settings,
}: {
  settings: SessionBarConfig['driverBadge'];
}) => {
  const focusedCarIdx = useFocusCarIdx();
  const focusedDriver = useFocusedDriver();
  const showIRatingChange = settings?.showIRatingChange ?? false;
  const iratingChange = useDriverStatsStore((s) =>
    showIRatingChange && focusedCarIdx !== undefined
      ? s.iratingChanges[focusedCarIdx]
      : undefined
  );
  return (
    <DriverRatingBadge
      license={focusedDriver?.licString}
      rating={focusedDriver?.iRating}
      iratingChange={iratingChange}
      format={settings?.badgeFormat ?? 'license-color-rating-bw'}
      noMargin={true}
    />
  );
};
