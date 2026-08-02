import { memo } from 'react';
type GantryView = 'standings-incidents' | 'lap-graph';

interface GantryTabBarProps {
  activeView: GantryView;
  onViewChange: (view: GantryView) => void;
  drivers: { carIdx: number; name: string; carNumber: string }[];
  followedCarIdx: number | null;
  onFollowChange: (carIdx: number | null) => void;
}

export const GantryTabBar = memo(
  ({
    activeView,
    onViewChange,
    drivers,
    followedCarIdx,
    onFollowChange,
  }: GantryTabBarProps) => {
    return (
      <div className="flex items-center gap-1 bg-slate-900 border-b border-slate-700/50 px-2 py-1 flex-shrink-0">
        {(['standings-incidents', 'lap-graph'] as GantryView[]).map((view) => (
          <button
            key={view}
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
        ))}
        <div className="flex-1" />
        {/* Follow Driver dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            Follow
          </span>
          <select
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
        </div>
      </div>
    );
  }
);
GantryTabBar.displayName = 'GantryTabBar';
