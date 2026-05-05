import { memo } from 'react';
import { TireIcon } from '@phosphor-icons/react';
import { useBrakeBias } from '../../hooks';

export const BrakeBiasItem = memo(() => {
  const brakeBias = useBrakeBias();
  if (
    !brakeBias ||
    typeof brakeBias.value !== 'number' ||
    isNaN(brakeBias.value)
  )
    return null;
  return (
    <div className="flex justify-center gap-1 items-center">
      <TireIcon />
      {brakeBias.isClio
        ? `${brakeBias.value.toFixed(0)}`
        : `${brakeBias.value.toFixed(1)}%`}
    </div>
  );
});
BrakeBiasItem.displayName = 'BrakeBiasItem';
