import { memo } from 'react';
import { useCurrentSessionType } from '@irdashies/context';

export const SessionNameItem = memo(() => {
  const session = useCurrentSessionType();
  return <div className="flex">{session}</div>;
});
SessionNameItem.displayName = 'SessionNameItem';
