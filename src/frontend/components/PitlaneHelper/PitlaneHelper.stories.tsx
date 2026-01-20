import type { Meta, StoryObj } from '@storybook/react-vite';

// Documentation component showing static examples
const PitlaneHelperDocs = () => {
  return (
    <div className="max-w-3xl space-y-6 text-slate-200 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pitlane Helper Widget</h1>
        <p className="text-slate-400">
          Assists with pit entry by showing speed delta, pitbox position, and warnings.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Features</h2>
        <ul className="list-disc list-inside space-y-2 text-sm ml-4">
          <li>
            <strong>Speed Delta Display:</strong> Shows how far over/under the pit speed limit you are
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-slate-300">
              <li>Green: Safe (more than 5 km/h under limit)</li>
              <li>Amber: Caution (0-5 km/h under limit)</li>
              <li>Red: Over limit</li>
              <li>Flashing Red Box: Severely over (more than 1.5 km/h over limit)</li>
            </ul>
          </li>
          <li><strong>Pitbox Distance:</strong> Countdown showing meters to your pitbox with progress bar</li>
          <li><strong>Early Pitbox Warning:</strong> Alerts when your pitbox is near pit entry (last 10% of track)</li>
          <li><strong>Pit Limiter Warning:</strong> Flashing warning when entering pit without limiter active</li>
          <li><strong>Team Race Critical Warning:</strong> Extra urgent warning after pit stop completion in team races</li>
          <li><strong>Pitlane Traffic:</strong> Shows count of cars ahead and behind in pitlane</li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Settings</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">Visibility</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li><strong>Show Mode:</strong> Approaching or On Pit Road</li>
              <li><strong>Approach Distance:</strong> 100-500m (default: 200m)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Warnings</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li><strong>Pit Limiter Warning:</strong> On/Off</li>
              <li><strong>Early Pitbox Warning:</strong> On/Off</li>
              <li><strong>Early Threshold:</strong> 25-150m (default: 75m)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Display</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li><strong>Pitlane Traffic:</strong> Show/Hide</li>
              <li><strong>Background Opacity:</strong> 0-100% (default: 80%)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Example Display States</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">Safe Speed (Under Limit)</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '150px'}}>
              <div className="flex flex-col items-center p-2 rounded">
                <div className="text-2xl font-bold text-green-500">-8.0 km/h</div>
                <div className="text-xs text-slate-400">Limit: 50 km/h</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-center text-sm">45m to pit</div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-500 h-full rounded-full" style={{width: '77%'}}></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">Slightly Over Limit</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '150px'}}>
              <div className="flex flex-col items-center p-2 rounded bg-red-600/50">
                <div className="text-2xl font-bold text-white">+1.0 km/h</div>
                <div className="text-xs text-white/80">Limit: 50 km/h</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-center text-sm">32m to pit</div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-500 h-full rounded-full" style={{width: '84%'}}></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">Severely Over Limit (Flashing)</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '150px'}}>
              <div className="flex flex-col items-center p-2 rounded bg-red-600">
                <div className="text-2xl font-bold text-white">+5.0 km/h</div>
                <div className="text-xs text-white/80">Limit: 50 km/h</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-center text-sm">28m to pit</div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-500 h-full rounded-full" style={{width: '86%'}}></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">All Warnings Active</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '150px'}}>
              <div className="flex flex-col items-center p-2 rounded bg-red-600">
                <div className="text-2xl font-bold text-white">+4.2 km/h</div>
                <div className="text-xs text-white/80">Limit: 50 km/h</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-center text-sm">65m to pit</div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-500 h-full rounded-full" style={{width: '67%'}}></div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="bg-red-700 text-center text-sm font-bold py-1 px-2 rounded animate-pulse">
                  ⚠ ACTIVATE LIMITER
                </div>
                <div className="bg-amber-600 text-center text-sm font-bold py-1 px-2 rounded">
                  ⚠ EARLY PITBOX
                </div>
                <div className="bg-blue-700 text-center text-xs py-1 px-2 rounded">
                  2 ahead • 1 behind
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-6 p-4 bg-blue-900/30 rounded border border-blue-700">
        <h3 className="text-lg font-semibold text-blue-400">
          Early Pitbox Detection
        </h3>

        <p className="text-sm">
          The widget uses a heuristic to detect &quot;early&quot; pitboxes: if your assigned
          pitbox is in the last 10% of the track (DriverPitTrkPct &gt; 0.90), it&apos;s likely near
          pit entry. This works for most tracks where pit lane runs parallel to the
          start/finish straight.
        </p>
      </div>


      <div className="space-y-2 p-4 bg-amber-900/30 rounded border border-amber-700">
        <h3 className="text-lg font-semibold text-amber-400">Visibility Behavior</h3>
        <p className="text-sm">
          This widget only displays when the player is in pitlane (PlayerTrackSurface = 1 or 2):
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm ml-4 text-slate-300">
          <li><strong>Surface 1:</strong> In pitbox (during pit stop)</li>
          <li><strong>Surface 2:</strong> On pit road (entering or exiting)</li>
          <li><strong>Surface 3:</strong> On track (widget hidden)</li>
        </ul>
        <p className="text-sm mt-2">
          The &quot;Approaching&quot; mode attempts to show the overlay before entering pit lane,
          but this depends on having accurate pit entry position data.
        </p>
      </div>
    </div>
  );
};

const meta: Meta<typeof PitlaneHelperDocs> = {
  title: 'Widgets/PitlaneHelper',
  component: PitlaneHelperDocs,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof PitlaneHelperDocs>;

export const Documentation: Story = {
  name: 'Widget Documentation & Examples',
};
