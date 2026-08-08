import { memo } from 'react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const SessionNameItem = memo(({ standalone }: SessionBarItemProps) => {
  const session = useSessionBarSnapshot()?.sessionName;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex">{session}</div>
    </div>
  );
});
SessionNameItem.displayName = 'SessionNameItem';
