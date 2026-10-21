import { memo } from 'react';
import { PushPin } from '@phosphor-icons/react';
import { Tooltip } from '../Tooltip/Tooltip';
type GantryView = 'standings-incidents' | 'lap-graph';

interface GantryTabBarProps {
  activeView: GantryView;
  onViewChange: (view: GantryView) => void;
  drivers: { carIdx: number; name: string; carNumber: string }[];
  followedCarIdx: number | null;
  onFollowChange: (carIdx: number | null) => void;
  alwaysOnTop: boolean;
  onAlwaysOnTopChange: (alwaysOnTop: boolean) => void;
}

const VIEW_TOOLTIPS: Record<GantryView, string> = {
  'standings-incidents':
    'Live running order by class, side by side with the incident feed. Use it to see who is in trouble and jump the replay straight to it.',
  'lap-graph':
    "Plots every driver's gap to the class leader lap by lap, so you can see where positions were won and lost.",
};

const FOCUS_NOTE =
  'Clicking the Gantry takes keyboard focus away from iRacing, the same as when it is not pinned.';

const PIN_TOOLTIPS = {
  on: `Kept on top of iRacing and other apps. Click to unpin. ${FOCUS_NOTE}`,
  off: `Keep the Gantry on top of iRacing and other apps. iRacing must run in borderless or windowed mode. ${FOCUS_NOTE}`,
};

export const GantryTabBar = memo(
  ({
    activeView,
    onViewChange,
    drivers,
    followedCarIdx,
    onFollowChange,
    alwaysOnTop,
    onAlwaysOnTopChange,
  }: GantryTabBarProps) => {
    return (
      <div className="flex items-center gap-1 bg-slate-900 border-b border-slate-700/50 px-2 py-1 flex-shrink-0">
        {(['standings-incidents', 'lap-graph'] as GantryView[]).map((view) => (
          <Tooltip key={view} content={VIEW_TOOLTIPS[view]} placement="bottom">
            <button
              onClick={() => onViewChange(view)}
              className={[
                'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors',
                activeView === view
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {view === 'standings-incidents'
                ? 'Standings & Incidents'
                : 'Lap Graph'}
            </button>
          </Tooltip>
        ))}
        <div className="flex-1" />
        {/* Follow Driver dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            Follow
          </span>
          <Tooltip
            content="Pins one driver: their standings row is highlighted, kept scrolled into view, and every other row is dimmed. Choose All to clear it."
            placement="bottom"
          >
            <select
              aria-label="Follow driver"
              value={followedCarIdx ?? ''}
              onChange={(e) =>
                onFollowChange(e.target.value ? Number(e.target.value) : null)
              }
              className="bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 px-2 py-1"
            >
              <option value="">All</option>
              {drivers.map((d) => (
                <option key={d.carIdx} value={d.carIdx}>
                  #{d.carNumber} {d.name}
                </option>
              ))}
            </select>
          </Tooltip>
        </div>
        <Tooltip
          content={alwaysOnTop ? PIN_TOOLTIPS.on : PIN_TOOLTIPS.off}
          placement="bottom"
        >
          <button
            type="button"
            aria-label="Keep on top"
            aria-pressed={alwaysOnTop}
            onClick={() => onAlwaysOnTopChange(!alwaysOnTop)}
            className={[
              'ml-1 p-1 rounded transition-colors',
              alwaysOnTop
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            <PushPin size={16} weight={alwaysOnTop ? 'fill' : 'regular'} />
          </button>
        </Tooltip>
      </div>
    );
  }
);
GantryTabBar.displayName = 'GantryTabBar';
