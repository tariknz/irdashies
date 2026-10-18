import { useEffect, useState } from 'react';
import type { KeybindingsMap } from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { BindingRow } from '../KeybindingsSettings';

const ACTION_ID = 'radar-flip-pole-side';

/**
 * The pole side key, also on the Key Bindings page. The radar guesses which
 * side the pole line of a start or restart is on, and some tracks differ, so
 * the player can flip it and have it remembered.
 */
export const RadarPoleSideKey = () => {
  const [bindings, setBindings] = useState<KeybindingsMap | null>(null);

  useEffect(() => {
    window.keybindingsBridge
      ?.getKeybindings()
      .then(setBindings)
      .catch((error: unknown) =>
        logger.error('Failed to load keybindings:', error)
      );
  }, []);

  const entry = bindings?.[ACTION_ID];

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        Pole side key
      </div>
      <p className="text-sm text-slate-400">
        In some cases the radar may draw the lanes on the wrong side at a start
        or restart, because the sim does not say which side the pole line is on.
        The key flips the side on the current track and remembers it for future
        races.
      </p>
      {entry && (
        <BindingRow
          actionId={ACTION_ID}
          entry={entry}
          onUpdated={setBindings}
        />
      )}
    </div>
  );
};
