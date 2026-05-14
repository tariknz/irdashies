import { useLiveSectorDelta } from '../hooks/useLiveSectorDelta';

/**
 * Live numeric delta on the active sector card. Isolated so its 60Hz updates
 * don't re-render the whole widget.
 */
export const LiveDelta = ({
  dp,
  fallback,
}: {
  dp: number;
  fallback: string;
}) => {
  const liveSectorDelta = useLiveSectorDelta();
  if (liveSectorDelta === null) return <>{fallback}</>;
  const sign = liveSectorDelta >= 0 ? '+' : '';
  return <>{`${sign}${liveSectorDelta.toFixed(dp)}`}</>;
};
