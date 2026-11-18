import { memo } from 'react';
import { PushPin } from '@phosphor-icons/react';
import logo from '../../../../assets/icons/logo.svg';
import { Tooltip } from '../Tooltip/Tooltip';
type GantryView = 'standings-incidents' | 'lap-graph' | 'pit-stops';

interface GantryTabBarProps {
  activeView: GantryView;
  onViewChange: (view: GantryView) => void;
  /** Display name of the sim feeding the Gantry, or null when none is. */
  connectedSimulator?: string | null;
  drivers: { carIdx: number; name: string; carNumber: string }[];
  followedCarIdx: number | null;
  onFollowChange: (carIdx: number | null) => void;
  alwaysOnTop: boolean;
  onAlwaysOnTopChange: (alwaysOnTop: boolean) => void;
}

const VIEW_LABELS: Record<GantryView, string> = {
  'standings-incidents': 'Standings & Incidents',
  'lap-graph': 'Lap Graph',
  'pit-stops': 'Pit Stops',
};

const VIEW_TOOLTIPS: Record<GantryView, string> = {
  'standings-incidents':
    'Live running order by class, side by side with the incident feed. Use it to see who is in trouble and jump the replay straight to it.',
  'lap-graph':
    "Plots every driver's gap to the class leader lap by lap, so you can see where positions were won and lost.",
  'pit-stops':
    "Every team's pit stops: when they stopped, how long they spent in the pit lane and stopped, driver changes, and an estimate of the service from the stop time.",
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
    connectedSimulator = null,
    drivers,
    followedCarIdx,
    onFollowChange,
    alwaysOnTop,
    onAlwaysOnTopChange,
  }: GantryTabBarProps) => {
    return (
      <div className="settings-shell @container shrink-0 bg-slate-950 text-slate-200">
        <header className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-700 px-4 py-1 @min-[64rem]:grid @min-[64rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="" className="h-7 w-7 shrink-0" />
            <span className="shrink-0 text-lg font-semibold tracking-[-0.04em] text-white">
              ir<span className="text-red-600">Dashies</span>
            </span>
            <span aria-hidden="true" className="h-5 w-px bg-slate-700" />
            <h1 className="text-sm font-normal text-slate-300">Gantry</h1>
          </div>
          <div className="flex min-w-0 flex-auto items-center justify-center justify-self-center gap-2 text-xs text-slate-400">
            {connectedSimulator && (
              <>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                  aria-hidden="true"
                />
                <span className="truncate">{connectedSimulator} connected</span>
              </>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end justify-self-end gap-2">
            <span className="text-sm text-slate-400">Follow</span>
            <Tooltip
              content="Pins one driver: their standings row is highlighted, kept scrolled into view, and every other row is dimmed. Choose All drivers to clear it."
              placement="bottom"
            >
              <select
                aria-label="Follow driver"
                value={followedCarIdx ?? ''}
                onChange={(e) =>
                  onFollowChange(e.target.value ? Number(e.target.value) : null)
                }
                className="settings-field w-48"
              >
                <option value="">All drivers</option>
                {drivers.map((d) => (
                  <option key={d.carIdx} value={d.carIdx}>
                    #{d.carNumber} {d.name}
                  </option>
                ))}
              </select>
            </Tooltip>
            <Tooltip
              content={alwaysOnTop ? PIN_TOOLTIPS.on : PIN_TOOLTIPS.off}
              placement="bottom"
            >
              <button
                type="button"
                aria-label="Keep on top"
                aria-pressed={alwaysOnTop}
                onClick={() => onAlwaysOnTopChange(!alwaysOnTop)}
                className="settings-button aria-pressed:border-accent-400 aria-pressed:text-accent-300"
              >
                <PushPin size={16} weight={alwaysOnTop ? 'fill' : 'regular'} />
                Keep on top
              </button>
            </Tooltip>
          </div>
        </header>
        <nav
          aria-label="Gantry views"
          className="flex items-end gap-1 border-b border-slate-700 bg-slate-900 px-4"
        >
          {(['standings-incidents', 'lap-graph', 'pit-stops'] as GantryView[]).map(
            (view) => (
              <Tooltip
                key={view}
                content={VIEW_TOOLTIPS[view]}
                placement="bottom"
              >
                <button
                  type="button"
                  aria-pressed={activeView === view}
                  onClick={() => onViewChange(view)}
                  className={[
                    'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                    activeView === view
                      ? 'border-accent-400 bg-accent-400/10 text-accent-200'
                      : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                  ].join(' ')}
                >
                  {VIEW_LABELS[view]}
                </button>
              </Tooltip>
            )
          )}
        </nav>
      </div>
    );
  }
);
GantryTabBar.displayName = 'GantryTabBar';
