import { useMemo } from 'react';
import { useChannelSelector } from '@irdashies/context';
import type { InputConfig } from '@irdashies/types';
import { createInputSelector, EMPTY_INPUTS } from './inputSelection';

/** Subscribe to only the controls this layout displays, with stable references. */
export const useInputs = (settings: InputConfig) => {
  const selector = useMemo(() => createInputSelector(settings), [settings]);
  return (
    useChannelSelector('driver-controls.snapshot', selector) ?? EMPTY_INPUTS
  );
};
