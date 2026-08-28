import { memo } from 'react';
import { TireIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const BrakeBiasItem = memo(({ standalone }: SessionBarItemProps) => {
  const snapshot = useSessionBarSnapshot();
  const brakeBias =
    snapshot?.brakeBias === undefined
      ? undefined
      : { value: snapshot.brakeBias, isClio: snapshot.brakeBiasIsClio };

  if (
    !brakeBias ||
    typeof brakeBias.value !== 'number' ||
    isNaN(brakeBias.value)
  )
    return null;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center">
        <TireIcon />
        {brakeBias.isClio
          ? `${brakeBias.value.toFixed(0)}`
          : `${brakeBias.value.toFixed(1)}%`}
      </div>
    </div>
  );
});
BrakeBiasItem.displayName = 'BrakeBiasItem';
