import type { Meta, StoryObj } from '@storybook/react-vite';

// Documentation component showing static examples
const PitlaneHelperDocs = () => {
  return (
    <div className="max-w-4xl space-y-6 text-slate-200 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pitlane Helper Widget</h1>
        <p className="text-slate-400">
          Comprehensive pit lane assistance with countdown bars, speed delta, pit exit inputs, and warnings.
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
          <li>
            <strong>Countdown Bars:</strong> Visual countdown to pit entry, pitbox, and pit exit
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-slate-300">
              <li>Color-coded: Green (far) → Yellow (medium) → Blue (close)</li>
              <li>Horizontal or vertical orientation</li>
              <li>Multiple bars shown side-by-side for compact layout</li>
            </ul>
          </li>
          <li><strong>Pit Exit Inputs:</strong> Throttle/clutch display for optimizing pit exit</li>
          <li><strong>Early Pitbox Warning:</strong> Alerts when your pitbox is near pit entry</li>
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
            <h3 className="font-semibold mb-2">Countdown Bars</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li><strong>Orientation:</strong> Horizontal or Vertical</li>
              <li><strong>Progress Bar Type:</strong> Color-coded gradients</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Pit Exit Inputs</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li><strong>Enable:</strong> On/Off</li>
              <li><strong>Show Throttle:</strong> On/Off</li>
              <li><strong>Show Clutch:</strong> On/Off</li>
              <li><strong>Display Phase:</strong> Always / At Pitbox / After Pitbox</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Warnings</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-300">
              <li><strong>Pit Limiter Warning:</strong> On/Off</li>
              <li><strong>Early Pitbox Warning:</strong> On/Off</li>
              <li><strong>Early Threshold:</strong> 25-300m (default: 75m)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Example Display States</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">Approaching Pit Entry</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '200px'}}>
              <div className="flex flex-col items-center p-2 rounded">
                <div className="text-2xl font-bold text-green-500">-8.0 km/h</div>
                <div className="text-xs text-slate-400">Limit: 72 km/h</div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center gap-2 w-full">
                  <div className="text-white text-sm font-medium">150m</div>
                  <div className="relative w-8 bg-slate-700/50 rounded overflow-hidden" style={{ height: '120px' }}>
                    <div className="absolute bottom-0 w-full transition-all duration-200 ease-out" style={{ height: '75%', backgroundColor: 'rgb(34, 197, 94)' }}></div>
                  </div>
                  <div className="text-slate-400 text-xs">Pit Entry</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">On Pit Road - Approaching Pitbox</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '200px'}}>
              <div className="flex flex-col items-center p-2 rounded bg-red-600/50">
                <div className="text-2xl font-bold text-white">+1.0 km/h</div>
                <div className="text-xs text-white/80">Limit: 72 km/h</div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center gap-2 w-full">
                  <div className="text-white text-sm font-medium">45m</div>
                  <div className="relative w-8 bg-slate-700/50 rounded overflow-hidden" style={{ height: '120px' }}>
                    <div className="absolute bottom-0 w-full transition-all duration-200 ease-out" style={{ height: '45%', backgroundColor: 'rgb(59, 130, 246)' }}></div>
                  </div>
                  <div className="text-slate-400 text-xs">Pitbox</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">Past Pitbox - Exiting</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '200px'}}>
              <div className="flex flex-col items-center p-2 rounded">
                <div className="text-2xl font-bold text-green-500">-5.0 km/h</div>
                <div className="text-xs text-slate-400">Limit: 72 km/h</div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center gap-2 w-full">
                  <div className="text-white text-sm font-medium">25m</div>
                  <div className="relative w-8 bg-slate-700/50 rounded overflow-hidden" style={{ height: '120px' }}>
                    <div className="absolute bottom-0 w-full transition-all duration-200 ease-out" style={{ height: '100%', backgroundColor: 'rgb(34, 197, 94)' }}></div>
                  </div>
                  <div className="text-slate-400 text-xs">Past Pitbox</div>
                </div>
                <div className="flex-1 flex flex-col items-center gap-2 w-full">
                  <div className="text-white text-sm font-medium">80m</div>
                  <div className="relative w-8 bg-slate-700/50 rounded overflow-hidden" style={{ height: '120px' }}>
                    <div className="absolute bottom-0 w-full transition-all duration-200 ease-out" style={{ height: '47%', backgroundColor: 'rgb(234, 179, 8)' }}></div>
                  </div>
                  <div className="text-slate-400 text-xs">Pit Exit</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">Pit Exit with Input Display</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '200px'}}>
              <div className="flex flex-col items-center p-2 rounded">
                <div className="text-2xl font-bold text-green-500">-2.0 km/h</div>
                <div className="text-xs text-slate-400">Limit: 72 km/h</div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center gap-2 w-full">
                  <div className="text-white text-sm font-medium">35m</div>
                  <div className="relative w-8 bg-slate-700/50 rounded overflow-hidden" style={{ height: '120px' }}>
                    <div className="absolute bottom-0 w-full transition-all duration-200 ease-out" style={{ height: '77%', backgroundColor: 'rgb(59, 130, 246)' }}></div>
                  </div>
                  <div className="text-slate-400 text-xs">Pit Exit</div>
                </div>
              </div>
              <div className="w-full">
                <div className="text-xs text-slate-400 mb-1">Pit Exit Inputs</div>
                <div className="h-16 bg-slate-700/30 rounded flex items-center justify-around p-2">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-400">Throttle</span>
                    <div className="w-full h-8 bg-slate-600 rounded relative overflow-hidden">
                      <div className="absolute bottom-0 w-full bg-green-500" style={{height: '65%'}}></div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 ml-2">
                    <span className="text-xs text-slate-400">Clutch</span>
                    <div className="w-full h-8 bg-slate-600 rounded relative overflow-hidden">
                      <div className="absolute bottom-0 w-full bg-blue-500" style={{height: '20%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-slate-300">All Warnings Active</p>
            <div className="flex flex-col gap-2 p-3 rounded text-white font-medium bg-slate-800/80" style={{minWidth: '200px'}}>
              <div className="flex flex-col items-center p-2 rounded bg-red-600">
                <div className="text-2xl font-bold text-white">+4.2 km/h</div>
                <div className="text-xs text-white/80">Limit: 72 km/h</div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center gap-2 w-full">
                  <div className="text-white text-sm font-medium">65m</div>
                  <div className="relative w-8 bg-slate-700/50 rounded overflow-hidden" style={{ height: '120px' }}>
                    <div className="absolute bottom-0 w-full transition-all duration-200 ease-out" style={{ height: '35%', backgroundColor: 'rgb(234, 179, 8)' }}></div>
                  </div>
                  <div className="text-slate-400 text-xs">Pitbox</div>
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
          Countdown Bar Colors
        </h3>
        <p className="text-sm">
          Countdown bars use a distance-based color gradient:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm ml-4 text-slate-300">
          <li><strong className="text-green-400">Green:</strong> More than 50% of max distance remaining (far away)</li>
          <li><strong className="text-yellow-400">Yellow:</strong> 25-50% of max distance remaining (getting closer)</li>
          <li><strong className="text-blue-400">Blue:</strong> Less than 25% of max distance remaining (very close)</li>
        </ul>
      </div>

      <div className="space-y-2 p-4 bg-amber-900/30 rounded border border-amber-700">
        <h3 className="text-lg font-semibold text-amber-400">Pit Detection</h3>
        <p className="text-sm">
          The widget uses OnPitRoad telemetry and PlayerTrackSurface to determine pit state:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm ml-4 text-slate-300">
          <li><strong>Surface 1:</strong> In pitbox (during pit stop)</li>
          <li><strong>Surface 2:</strong> In pit blend zone (before pit entry line)</li>
          <li><strong>OnPitRoad = true:</strong> Past pit entry line (actually on pit road)</li>
          <li><strong>Surface 3:</strong> On track (widget hidden unless approaching)</li>
        </ul>
        <p className="text-sm mt-2">
          Pit entry/exit positions are detected automatically with tolerance-based auto-correction
          to handle variations in telemetry data.
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
