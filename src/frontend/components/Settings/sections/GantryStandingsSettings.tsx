import { useNavigate } from 'react-router-dom';
import { PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { useDashboard } from '@irdashies/context';
import {
  resolveGantryStandings,
  type GantryStandingsSource,
} from '@irdashies/types';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingsSection } from '../components/SettingSection';
import {
  copyOverlayToGantryStandings,
  createGantryStandingsLayout,
  deleteGantryStandingsLayout,
  newGantryStandingsId,
  readGantryStandings,
  withGantryStandings,
} from './gantryStandingsEdits';

const SOURCE_OPTIONS: { label: string; value: GantryStandingsSource }[] = [
  { label: 'Built-in Gantry view', value: 'builtin' },
  { label: 'Use overlay: Standings', value: 'overlay' },
  { label: 'Gantry-only standings layout', value: 'gantry' },
];

const SOURCE_DESCRIPTION =
  'The built-in view is the Gantry table with its fixed columns. The other two draw the full Standings widget, so every Standings option applies. A Gantry-only layout starts as a copy of the overlay settings and can then be changed without touching the overlay.';

const smallButtonClass =
  'flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors';

/** Settings > Gantry > Standings. */
export const GantryStandingsSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const navigate = useNavigate();
  if (!currentDashboard) return null;

  const saved = readGantryStandings(currentDashboard);
  const resolved = resolveGantryStandings(currentDashboard);
  const layoutId =
    resolved.status === 'ready' && resolved.source === 'gantry'
      ? resolved.widget.id
      : undefined;
  const hasOverlay = currentDashboard.widgets.some((w) => w.id === 'standings');

  const commit = (next: typeof currentDashboard) => onDashboardUpdated?.(next);

  const createLayout = () => {
    const widgetId = newGantryStandingsId();
    commit(createGantryStandingsLayout(currentDashboard, widgetId));
    navigate(`/settings/${widgetId}`);
  };

  return (
    <SettingsSection title="Standings">
      <SettingSelectRow<GantryStandingsSource>
        title="Standings view"
        description={SOURCE_DESCRIPTION}
        value={saved.source}
        options={SOURCE_OPTIONS.map((option) => ({
          ...option,
          disabled: option.value === 'overlay' && !hasOverlay,
        }))}
        onChange={(source) =>
          commit(withGantryStandings(currentDashboard, { ...saved, source }))
        }
      />

      {saved.source === 'overlay' && (
        <p className="text-xs text-slate-400">
          Uses the overlay Standings settings as they are. The Gantry always
          lists every driver and ignores the overlay's visibility rules.
        </p>
      )}

      {saved.source === 'gantry' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {!layoutId && (
              <button
                type="button"
                onClick={createLayout}
                className={`${smallButtonClass} bg-green-800/60 hover:bg-green-700 text-green-100 border-green-700`}
              >
                <PlusIcon size={12} /> Create Gantry standings layout (copy of
                overlay)
              </button>
            )}
            {layoutId && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/settings/${layoutId}`)}
                  className={`${smallButtonClass} bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600`}
                >
                  Edit standings layout
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commit(
                      copyOverlayToGantryStandings(currentDashboard, layoutId)
                    )
                  }
                  className={`${smallButtonClass} bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600`}
                >
                  Copy settings from overlay
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commit(
                      deleteGantryStandingsLayout(currentDashboard, layoutId)
                    )
                  }
                  className={`${smallButtonClass} bg-red-900/50 hover:bg-red-900 text-red-200 border-red-800`}
                >
                  <TrashIcon size={12} /> Delete layout
                </button>
              </>
            )}
          </div>

          {!layoutId && (
            <p className="flex items-center gap-1 text-xs text-amber-300">
              <WarningIcon size={14} />
              {resolved.status === 'removed'
                ? 'The Gantry-only standings layout was removed. The built-in view is showing until you create another.'
                : 'No Gantry-only layout yet. The built-in view is showing until you create one.'}
            </p>
          )}
        </div>
      )}
    </SettingsSection>
  );
};
