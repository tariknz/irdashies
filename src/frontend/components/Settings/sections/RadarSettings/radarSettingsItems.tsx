import type { ReactNode } from 'react';
import {
  DEFAULT_RADAR_TUNING,
  getWidgetDefaultConfig,
  type RadarConfig,
  type RadarTuning,
} from '@irdashies/types';
import { SessionVisibility } from '../../components/SessionVisibility';
import { SettingButtonGroupRow } from '../../components/SettingButtonGroupRow';
import { SettingSelectRow } from '../../components/SettingSelectRow';
import { SettingSliderRow } from '../../components/SettingSliderRow';
import { SettingToggleRow } from '../../components/SettingToggleRow';
import {
  ClassSizeRows,
  ColorPickRow,
  ColorRow,
  CustomColorRow,
  hex,
  NumberRow,
} from './controls';
import { ConfigJson, PoleSidesTable } from './RadarDevTools';
import { ArcEventCard } from './ArcControls';

export const RADAR_DEFAULTS = getWidgetDefaultConfig('radar');

/** 0 basic, 1 advanced, 2 dev: an item shows at its level and above. */
export type SettingsLevel = 0 | 1 | 2;

export interface ItemContext {
  /** The config as the profile being edited sees it. */
  view: RadarConfig;
  set: (change: Partial<RadarConfig>) => void;
  /** The stored config, both profiles, and its unrouted setter. */
  config: RadarConfig;
  setConfig: (change: Partial<RadarConfig>) => void;
  setTuning: (change: Partial<RadarTuning>) => void;
}

export interface RadarSettingItem {
  id: string;
  level: SettingsLevel;
  /** Also what the search matches, with the description. */
  title: string;
  description?: string;
  /** Settings this row edits, for the changed marker and the resets. */
  keys?: (keyof RadarConfig)[];
  tuningKeys?: (keyof RadarTuning)[];
  /** Left out while a setting it depends on is off. */
  hidden?: (view: RadarConfig) => boolean;
  render: (ctx: ItemContext) => ReactNode;
}

export type RadarSectionGroup = 'radar' | 'modules' | 'other' | 'dev';

export interface RadarSettingSection {
  id: string;
  title: string;
  /** Where the section sits in the side list. */
  group: RadarSectionGroup;
  /** One line under the title. */
  summary?: string;
  /**
   * The module's on/off switch, shown in the section header. While it is
   * off the section's settings are hidden.
   */
  master?: BooleanKey;
  /** The module's rim arc, set in the Arcs section and linked from here. */
  arc?: { on: BooleanKey; style: ArcStyleKey };
  dev?: boolean;
  items: RadarSettingItem[];
}

type BooleanKey = {
  [K in keyof RadarConfig]: RadarConfig[K] extends boolean ? K : never;
}[keyof RadarConfig];
type NumberKey = {
  [K in keyof RadarConfig]: RadarConfig[K] extends number ? K : never;
}[keyof RadarConfig];

const toggle = (
  level: SettingsLevel,
  key: BooleanKey,
  title: string,
  description?: string,
  hidden?: RadarSettingItem['hidden']
): RadarSettingItem => ({
  id: key,
  level,
  title,
  description,
  keys: [key],
  hidden,
  render: ({ view, set }) => (
    <SettingToggleRow
      title={title}
      description={description}
      enabled={view[key]}
      onToggle={(value) => set({ [key]: value })}
    />
  ),
});

interface SliderRange {
  units?: string;
  min: number;
  max: number;
  step: number;
}

const slider = (
  level: SettingsLevel,
  key: NumberKey,
  title: string,
  range: SliderRange,
  description?: string,
  hidden?: RadarSettingItem['hidden']
): RadarSettingItem => ({
  id: key,
  level,
  title,
  description,
  keys: [key],
  hidden,
  render: ({ view, set }) => (
    <SettingSliderRow
      title={title}
      description={description}
      value={view[key]}
      {...range}
      onChange={(value) => set({ [key]: value })}
    />
  ),
});

type NumericTuningKey = {
  [K in keyof RadarTuning]: RadarTuning[K] extends number ? K : never;
}[keyof RadarTuning];

const tuningNumber = (
  key: NumericTuningKey,
  description: string,
  min: number,
  max: number,
  step: number
): RadarSettingItem => ({
  id: `tuning.${key}`,
  level: 2,
  title: key,
  description,
  tuningKeys: [key],
  render: ({ view, setTuning }) => (
    <NumberRow
      title={key}
      description={description}
      value={view.tuning[key]}
      min={min}
      max={max}
      step={step}
      onChange={(value) => setTuning({ [key]: value })}
    />
  ),
});

const tuningToggle = (
  key: 'debugLabels' | 'showFrameTime',
  title: string,
  description: string
): RadarSettingItem => ({
  id: `tuning.${key}`,
  level: 2,
  title,
  description,
  tuningKeys: [key],
  render: ({ view, setTuning }) => (
    <SettingToggleRow
      title={title}
      description={description}
      enabled={view.tuning[key]}
      onToggle={(value) => setTuning({ [key]: value })}
    />
  ),
});

/** Every session, Warmup included, which the other widgets leave out. */
const RADAR_SESSIONS = [
  'race',
  'loneQualify',
  'openQualify',
  'practice',
  'warmup',
  'offlineTesting',
] as const satisfies readonly (keyof RadarConfig['sessionVisibility'])[];

const autoHideOff = (view: RadarConfig) => !view.autoHide;

/** Warn early, normally or late: bumper gaps for the amber warning. */
const SENSITIVITY = [
  { label: 'Early', value: '10' },
  { label: 'Normal', value: String(RADAR_DEFAULTS.cautionDistance) },
  { label: 'Late', value: '4' },
];

const PALETTES = {
  standard: { closeColor: 0xf59e0b, alongsideColor: 0xef4444 },
  // Blue and orange stay apart for red-green colour blindness.
  colourBlind: { closeColor: 0x38bdf8, alongsideColor: 0xf97316 },
} as const;

export type ArcStyleKey = 'warningArcStyle' | 'diveArcStyle' | 'hazardArcStyle';

/** On/off and the look of one event's arc, with pictures to pick from. */
const arcCard = (
  key: BooleanKey,
  styleKey: ArcStyleKey,
  module: BooleanKey,
  title: string,
  description: string,
  bearing: number
): RadarSettingItem => ({
  id: key,
  level: 0,
  title: `${title} Arc`,
  description,
  keys: [key, styleKey],
  render: ({ view, set }) => (
    <ArcEventCard
      title={title}
      description={description}
      enabled={view[key]}
      onToggle={(value) => set({ [key]: value })}
      style={view[styleKey]}
      onStyle={(value) => set({ [styleKey]: value })}
      moduleOff={!view[module]}
      moduleName={title}
      color={hex(view.alongsideColor)}
      bearing={bearing}
      thickness={view.arcThickness}
    />
  ),
});

/** The span of one event's arc, as a pair of sliders. */
const arcLength = (
  minKey: NumberKey,
  maxKey: NumberKey,
  title: string,
  arcKey: BooleanKey,
  module: BooleanKey,
  description = 'Half the arc either side of the car: for one far off, and one right beside you.'
): RadarSettingItem => ({
  id: minKey,
  level: 1,
  title: `${title} Arc Length`,
  description,
  keys: [minKey, maxKey],
  hidden: (view) => !view[arcKey] || !view[module],
  render: ({ view, set }) => (
    <div className="space-y-2 pl-3 border-l-2 border-slate-700">
      <SettingSliderRow
        title={`${title} Arc, Smallest`}
        description={description}
        value={view[minKey]}
        units="°"
        min={2}
        max={30}
        step={1}
        onChange={(value) =>
          set({ [minKey]: value, [maxKey]: Math.max(view[maxKey], value) })
        }
      />
      <SettingSliderRow
        title={`${title} Arc, Largest`}
        value={view[maxKey]}
        units="°"
        min={4}
        max={45}
        step={1}
        onChange={(value) =>
          set({ [maxKey]: value, [minKey]: Math.min(view[minKey], value) })
        }
      />
    </div>
  ),
});

export const RADAR_SECTIONS: RadarSettingSection[] = [
  {
    id: 'visibility',
    title: 'When to Show',
    group: 'radar',
    items: [
      {
        id: 'autoHide',
        level: 0,
        title: 'Show Radar',
        description:
          'Only when a car is near keeps the radar off screen the rest of the time.',
        keys: ['autoHide'],
        render: ({ view, set }) => (
          <SettingButtonGroupRow
            title="Show Radar"
            description="Only when a car is near keeps the radar off screen the rest of the time."
            value={view.autoHide ? 'near' : 'always'}
            options={[
              { label: 'Always', value: 'always' },
              { label: 'When a car is near', value: 'near' },
            ]}
            onChange={(value) => set({ autoHide: value === 'near' })}
          />
        ),
      },
      {
        id: 'showDistance',
        level: 1,
        title: 'Show Within',
        description: 'The radar appears when a car comes this close.',
        keys: ['showDistance'],
        hidden: autoHideOff,
        render: ({ view, set }) => (
          <SettingSliderRow
            title="Show Within"
            description="The radar appears when a car comes this close."
            value={view.showDistance}
            units="m"
            min={5}
            max={100}
            step={1}
            onChange={(value) =>
              set({
                showDistance: value,
                hideDistance: Math.max(view.hideDistance, value),
              })
            }
          />
        ),
      },
      {
        id: 'hideDistance',
        level: 1,
        title: 'Hide Beyond',
        description:
          'The radar leaves once every car is further than this. Kept above Show Within so it does not blink.',
        keys: ['hideDistance'],
        hidden: autoHideOff,
        render: ({ view, set }) => (
          <SettingSliderRow
            title="Hide Beyond"
            description="The radar leaves once every car is further than this. Kept above Show Within so it does not blink."
            value={view.hideDistance}
            units="m"
            min={view.showDistance}
            max={120}
            step={1}
            onChange={(value) => set({ hideDistance: value })}
          />
        ),
      },
      slider(1, 'fadeSeconds', 'Fade Time', {
        units: 's',
        min: 0,
        max: 2,
        step: 0.1,
      }),
      toggle(
        0,
        'showOnlyWhenOnTrack',
        'Only When on Track',
        'Hide the radar while you are not driving.'
      ),
      toggle(
        0,
        'hideInPitBox',
        'Hide in Pit Box',
        'Keep the radar off screen while your car is parked in its pit box.'
      ),
      toggle(
        1,
        'hideInPit',
        'Hide Cars Across the Pit Wall',
        'On track, hide cars on pit road; on pit road, hide cars on track.'
      ),
      {
        id: 'sessionVisibility',
        level: 0,
        title: 'Sessions',
        description: 'Race, qualifying, practice, warmup, testing.',
        keys: ['sessionVisibility'],
        render: ({ view, set }) => (
          <div className="space-y-3">
            <h4 className="text-md font-medium text-slate-300">Sessions</h4>
            <SessionVisibility
              sessionVisibility={view.sessionVisibility}
              sessions={RADAR_SESSIONS}
              handleConfigChange={(change) =>
                set(change as Partial<RadarConfig>)
              }
            />
          </div>
        ),
      },
    ],
  },
  {
    id: 'look',
    title: 'Look',
    group: 'radar',
    items: [
      slider(
        0,
        'range',
        'Range',
        { units: 'm', min: 10, max: 100, step: 5 },
        'Metres from your car to the edge of the radar.'
      ),
      {
        id: 'background',
        level: 0,
        title: 'Background Opacity',
        keys: ['background'],
        render: ({ view, set }) => (
          <SettingSliderRow
            title="Background Opacity"
            value={view.background.opacity}
            units="%"
            min={0}
            max={100}
            step={5}
            onChange={(value) => set({ background: { opacity: value } })}
          />
        ),
      },
      toggle(
        0,
        'showTrackMap',
        'Show Road',
        'Draw the track under the cars, turning with your car.'
      ),
      slider(
        1,
        'mapOpacity',
        'Road Opacity',
        { units: '%', min: 5, max: 100, step: 5 },
        undefined,
        (view) => !view.showTrackMap
      ),
      slider(
        1,
        'trackWidth',
        'Road Width',
        { units: 'm', min: 6, max: 25, step: 1 },
        'The track drawings carry no width, so pick one that looks right.',
        (view) => !view.showTrackMap
      ),
      toggle(0, 'showCarNumbers', 'Car Numbers'),
      {
        id: 'rivalColorMode',
        level: 0,
        title: 'Rival Colour',
        description:
          'Colour rivals by licence (as on the rating badge), by car class, or all the same.',
        keys: ['rivalColorMode'],
        render: ({ view, set }) => (
          <SettingSelectRow
            title="Rival Colour"
            description="Colour rivals by licence (as on the rating badge), by car class, or all the same."
            value={view.rivalColorMode}
            options={[
              { label: 'Licence (safety rating)', value: 'safety' },
              { label: 'Car class', value: 'class' },
              { label: 'Custom', value: 'custom' },
            ]}
            onChange={(value) => set({ rivalColorMode: value })}
          />
        ),
      },
      {
        id: 'rivalCustomColor',
        level: 0,
        title: 'Rival Fill',
        keys: ['rivalCustomColor'],
        hidden: (view) => view.rivalColorMode !== 'custom',
        render: ({ view, set }) => (
          <CustomColorRow
            value={view.rivalCustomColor}
            playerColor={view.playerColor}
            onChange={(value) => set({ rivalCustomColor: value })}
          />
        ),
      },
      {
        id: 'playerColor',
        level: 1,
        title: 'Your Car',
        keys: ['playerColor'],
        render: ({ view, set }) => (
          <ColorRow
            title="Your Car"
            value={view.playerColor}
            onChange={(value) => set({ playerColor: value })}
          />
        ),
      },
      slider(
        1,
        'edgeFade',
        'Edge Fade',
        { units: '%', min: 0, max: 100, step: 5 },
        'How much of the radar fades out towards the edge, so cars ease in and out. 0% for a hard edge.'
      ),
      toggle(1, 'showRings', 'Distance Rings'),
      slider(
        1,
        'ringSpacing',
        'Ring Spacing',
        { units: 'm', min: 5, max: 50, step: 5 },
        undefined,
        (view) => !view.showRings
      ),
      toggle(
        1,
        'showCrosshair',
        'Crosshair',
        'Dashed lines through your car, ahead/behind and left/right.'
      ),
      toggle(
        0,
        'axisMotion',
        'Moving Centre Line',
        'The dashes of the line ahead run past at your speed, like road markings.',
        (view) => !view.showCrosshair
      ),
      slider(
        1,
        'axisDashLength',
        'Dash Length',
        { units: 'm', min: 1, max: 10, step: 0.5 },
        'Each gap is twice as long as a dash.',
        (view) => !view.showCrosshair || !view.axisMotion
      ),
      slider(
        1,
        'axisSpeed',
        'Dash Speed',
        { units: '%', min: 10, max: 100, step: 5 },
        'Share of your own speed. Lower it if fast dashes flicker.',
        (view) => !view.showCrosshair || !view.axisMotion
      ),
    ],
  },
  {
    id: 'arcs',
    title: 'Arcs',
    group: 'radar',
    summary:
      'Marks on the rim towards a car worth watching. Every arc is here: whether it shows, how it looks and how long it is.',
    items: [
      slider(
        0,
        'arcThickness',
        'Thickness',
        { units: '%', min: 3, max: 14, step: 1 },
        'Of every arc, as a share of the radar radius.'
      ),
      arcCard(
        'warningArcs',
        'warningArcStyle',
        'showWarnings',
        'Close Cars',
        'Towards a car close by or alongside.',
        Math.PI
      ),
      arcLength(
        'arcMinDeg',
        'arcMaxDeg',
        'Close Cars',
        'warningArcs',
        'showWarnings'
      ),
      arcCard(
        'diveArcs',
        'diveArcStyle',
        'showDiveWarning',
        'Dive-Bomb',
        'Towards a car closing fast from behind or diving in.',
        Math.PI * 0.62
      ),
      arcLength(
        'diveArcMinDeg',
        'diveArcMaxDeg',
        'Dive-Bomb',
        'diveArcs',
        'showDiveWarning'
      ),
      arcCard(
        'hazardArcs',
        'hazardArcStyle',
        'showHazards',
        'Hazards Ahead',
        'Under the hazard triangle. Off leaves the triangle and the distance.',
        -Math.PI / 2
      ),
      arcLength(
        'hazardArcMinDeg',
        'hazardArcMaxDeg',
        'Hazards Ahead',
        'hazardArcs',
        'showHazards',
        'Far off at the smallest, at the edge of the disc at the largest.'
      ),
    ],
  },
  {
    id: 'warnings',
    title: 'Close Cars',
    group: 'modules',
    summary:
      'Outlines on the car and arcs on the rim: amber when a car is close, pulsing red when it is alongside.',
    master: 'showWarnings',
    arc: { on: 'warningArcs', style: 'warningArcStyle' },
    items: [
      {
        id: 'sensitivity',
        level: 0,
        title: 'Warn',
        description: 'How close a car gets before it turns amber.',
        keys: ['cautionDistance'],
        hidden: (view) => !view.showWarnings,
        render: ({ view, set }) => (
          <SettingButtonGroupRow
            title="Warn"
            description="How close a car gets before it turns amber."
            value={String(view.cautionDistance)}
            options={SENSITIVITY}
            onChange={(value) => set({ cautionDistance: Number(value) })}
          />
        ),
      },
      slider(
        1,
        'cautionDistance',
        'Close Within',
        { units: 'm', min: 1, max: 20, step: 0.5 },
        'Bumper-to-bumper gap at which a car turns amber.',
        (view) => !view.showWarnings
      ),
      toggle(
        1,
        'showGapLabel',
        'Gap Distance',
        'Write the bumper-to-bumper gap next to an amber car.',
        (view) => !view.showWarnings
      ),
      {
        id: 'warningColors',
        level: 1,
        title: 'Warning Colours',
        description: 'Close and alongside.',
        keys: ['closeColor', 'alongsideColor'],
        hidden: (view) => !view.showWarnings,
        render: ({ view, set }) => (
          <div className="space-y-3">
            <ColorPickRow
              title="Close"
              value={view.closeColor}
              onChange={(value) => set({ closeColor: value })}
            />
            <ColorPickRow
              title="Alongside"
              value={view.alongsideColor}
              onChange={(value) => set({ alongsideColor: value })}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md"
                onClick={() => set(PALETTES.standard)}
              >
                Standard
              </button>
              <button
                type="button"
                className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md"
                onClick={() => set(PALETTES.colourBlind)}
              >
                Colour-blind friendly
              </button>
            </div>
          </div>
        ),
      },
      slider(
        1,
        'pulseHz',
        'Pulse Rate',
        { units: 'Hz', min: 0, max: 5, step: 0.5 },
        'How fast a car alongside pulses. 0 keeps it steady.',
        (view) => !view.showWarnings
      ),
    ],
  },
  {
    id: 'overlap',
    title: 'Overlap',
    group: 'modules',
    summary:
      'A strip along the side a car is on, showing how far it reaches along your car. It turns red once the car is owed room. When you attack, it shows on their car how far along it you reach.',
    master: 'showOverlap',
    items: [
      {
        id: 'overlapThreshold',
        level: 0,
        title: 'Room Owed From',
        description: 'How far alongside a car must be before it is owed room.',
        keys: ['overlapThreshold'],
        hidden: (view) => !view.showOverlap,
        render: ({ view, set }) => (
          <SettingButtonGroupRow
            title="Room Owed From"
            description="How far alongside a car must be before it is owed room."
            value={view.overlapThreshold}
            options={[
              { label: 'Rear wheel', value: 'rearWheel' },
              { label: 'Door', value: 'door' },
              { label: 'Front wheel', value: 'frontWheel' },
            ]}
            onChange={(value) =>
              set({
                overlapThreshold: value as RadarConfig['overlapThreshold'],
              })
            }
          />
        ),
      },
      toggle(
        1,
        'overlapShowPercent',
        'Overlap in Per Cent',
        'Write the overlap next to the strip.',
        (view) => !view.showOverlap
      ),
    ],
  },
  {
    id: 'dive',
    title: 'Dive-Bomb',
    group: 'modules',
    summary:
      'Warns about a car coming up much faster from behind before it gets to your side: amber while it closes, then pulsing red and a dashed outline where it is about to be. Off under yellow, behind the pace car and on pit road.',
    master: 'showDiveWarning',
    arc: { on: 'diveArcs', style: 'diveArcStyle' },
    items: [
      slider(
        1,
        'diveMinClosingKmh',
        'Closing Faster Than',
        { units: 'km/h', min: 5, max: 40, step: 1 },
        'Cars closing slower than this are left alone.',
        (view) => !view.showDiveWarning
      ),
      slider(
        1,
        'diveWarnSeconds',
        'Seconds to Your Side',
        { units: 's', min: 0.5, max: 2.5, step: 0.1 },
        'Turns red when the car will be beside you within this time and you are braking, or it has already pulled out. Amber starts at twice this.',
        (view) => !view.showDiveWarning
      ),
      toggle(
        1,
        'diveGhost',
        'Show Where It Will Be',
        'A dashed outline of the diving car 0.8 s ahead, with an arrow to it.',
        (view) => !view.showDiveWarning
      ),
      toggle(
        1,
        'diveShowClosing',
        'Show Closing Speed',
        'Write how much faster the car is in km/h, and the seconds until it is beside you.',
        (view) => !view.showDiveWarning
      ),
    ],
  },
  {
    id: 'hazards',
    title: 'Hazards Ahead',
    group: 'modules',
    summary:
      'Marks a car ahead that crashed, crawls, went off or is coming back on, before it comes into view: a triangle on the rim in its direction along the track, with how far it is. Brings the radar up when auto-hide has it away. Off under a full-course caution and behind the pace car.',
    master: 'showHazards',
    arc: { on: 'hazardArcs', style: 'hazardArcStyle' },
    items: [
      slider(
        0,
        'hazardRange',
        'Warn From',
        { units: 'm', min: 100, max: 1000, step: 50 },
        'How far ahead a hazard is shown.',
        (view) => !view.showHazards
      ),
      slider(
        1,
        'hazardBlinkDistance',
        'Flash Closer Than',
        { units: 'm', min: 0, max: 500, step: 25 },
        'A crashed or slow car flashes from this close. A car coming back on flashes at any distance; one sitting off the track never does.',
        (view) => !view.showHazards
      ),
      toggle(
        1,
        'hazardCrash',
        'Crashed and Stopped Cars',
        'A car that dropped from racing speed in a moment, or stands still. Red.',
        (view) => !view.showHazards
      ),
      toggle(
        1,
        'hazardSlow',
        'Slow Cars',
        'A car under 60% of the speed the field does at that spot of the lap. The radar learns those speeds as cars go round, so this needs a lap or so. Amber.',
        (view) => !view.showHazards
      ),
      toggle(
        1,
        'hazardOff',
        'Off Track and Rejoining',
        'A car off the track for more than half a second, then while it gets back up to speed. Yellow.',
        (view) => !view.showHazards
      ),
      toggle(
        1,
        'hazardShowSpeed',
        'Show Its Speed',
        'Write the hazard car speed in km/h under the distance.',
        (view) => !view.showHazards
      ),
    ],
  },
  {
    id: 'sizes',
    title: 'Car Sizes',
    group: 'other',
    items: [
      toggle(
        1,
        'sizeByClass',
        'Size Cars by Class',
        'Draw prototypes, stock cars and formula cars at their own typical size instead of the default. Sizes also decide when a car counts as alongside or close.'
      ),
      slider(
        1,
        'carLength',
        'Default Car Length',
        { units: 'm', min: 3, max: 6, step: 0.1 },
        'iRacing does not report car sizes. Used for classes the radar does not recognise.'
      ),
      slider(1, 'carWidth', 'Default Car Width', {
        units: 'm',
        min: 1.4,
        max: 2.4,
        step: 0.1,
      }),
      {
        id: 'classSizes',
        level: 1,
        title: 'Class Sizes',
        description: 'Length and width for each class in this session.',
        keys: ['classSizes'],
        hidden: (view) => !view.sizeByClass,
        render: ({ view, set }) => (
          <ClassSizeRows
            classSizes={view.classSizes}
            fallback={{ length: view.carLength, width: view.carWidth }}
            onChange={(classSizes) => set({ classSizes })}
          />
        ),
      },
    ],
  },
  {
    id: 'processing',
    group: 'dev',
    title: 'Processing',
    dev: true,
    items: [
      tuningNumber(
        'speedSmoothing',
        'Weight of the newest sample in the per-car speed average, 0-1. Lower is smoother but lags.',
        0.05,
        1,
        0.05
      ),
      tuningNumber(
        'extrapolationS',
        'Seconds a car is moved on between snapshots, at most.',
        0,
        0.5,
        0.01
      ),
      tuningNumber(
        'laneRate',
        'Lanes per second a car slides when its lane changes.',
        0.5,
        20,
        0.5
      ),
      tuningNumber(
        'laneGapM',
        'Metres between cars in neighbouring lanes.',
        0,
        3,
        0.1
      ),
      tuningNumber(
        'overlapSearchM',
        'Metres searched for the cars the spotter calls, when none overlap.',
        5.5,
        20,
        0.5
      ),
      tuningNumber(
        'poleLearnAfterS',
        'Seconds after the green in which the pole side is learnt.',
        0,
        60,
        1
      ),
      tuningNumber(
        'poleFlipFrames',
        'Frames in a row the spotter must disagree before the pole side flips (25 a second).',
        5,
        250,
        5
      ),
      tuningNumber(
        'gridMaxSpeedMs',
        'Below this speed, in m/s, cars count as parked on the grid.',
        0,
        10,
        0.5
      ),
      tuningNumber(
        'minLabelPx',
        'Car numbers are left out on cars drawn smaller than this, in px.',
        4,
        20,
        1
      ),
    ],
  },
  {
    id: 'debug',
    group: 'dev',
    title: 'Debug',
    dev: true,
    items: [
      tuningToggle(
        'debugLabels',
        'Car Index and Lane',
        'Write each car index and lane next to it on the radar.'
      ),
      tuningToggle(
        'showFrameTime',
        'Frame Time',
        'Write how long a frame takes to draw.'
      ),
    ],
  },
  {
    id: 'tools',
    group: 'dev',
    title: 'Tools',
    dev: true,
    items: [
      {
        id: 'poleSides',
        level: 2,
        title: 'Learnt Pole Sides',
        description:
          'Sides of the pole column the radar learnt from the spotter, by track.',
        render: () => <PoleSidesTable />,
      },
      {
        id: 'json',
        level: 2,
        title: 'Export / Import',
        description: 'The whole radar config as JSON, to share or attach.',
        render: ({ config, setConfig }) => (
          <ConfigJson config={config} onApply={setConfig} />
        ),
      },
    ],
  },
];

/** Looks to start from; each sets these and leaves the rest alone. */
export const RADAR_PRESETS: {
  id: string;
  title: string;
  description: string;
  values: Partial<RadarConfig>;
}[] = [
  {
    id: 'minimal',
    title: 'Minimal',
    description: 'Cars only',
    values: {
      showTrackMap: false,
      showRings: false,
      showCrosshair: false,
      showCarNumbers: false,
      background: { opacity: 25 },
      edgeFade: 50,
    },
  },
  {
    id: 'standard',
    title: 'Standard',
    description: 'The defaults',
    values: {},
  },
  {
    id: 'detailed',
    title: 'Detailed',
    description: 'Road, rings, numbers',
    values: {
      showTrackMap: true,
      mapOpacity: 55,
      showRings: true,
      showCrosshair: true,
      showCarNumbers: true,
      background: { opacity: 65 },
      edgeFade: 20,
    },
  },
];

const PRESET_KEYS = [
  'showTrackMap',
  'mapOpacity',
  'showRings',
  'showCrosshair',
  'showCarNumbers',
  'background',
  'edgeFade',
] as const satisfies readonly (keyof RadarConfig)[];

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export const presetChange = (
  preset: (typeof RADAR_PRESETS)[number]
): Partial<RadarConfig> =>
  Object.fromEntries(
    PRESET_KEYS.map((key) => [key, preset.values[key] ?? RADAR_DEFAULTS[key]])
  );

/** The preset the view matches, if any. */
export const matchingPreset = (view: RadarConfig) =>
  RADAR_PRESETS.find((preset) =>
    PRESET_KEYS.every((key) =>
      same(view[key], preset.values[key] ?? RADAR_DEFAULTS[key])
    )
  );

export const isChanged = (item: RadarSettingItem, view: RadarConfig) =>
  (item.keys ?? []).some((key) => !same(view[key], RADAR_DEFAULTS[key])) ||
  (item.tuningKeys ?? []).some(
    (key) => view.tuning[key] !== DEFAULT_RADAR_TUNING[key]
  );

export const resetChange = (
  items: readonly RadarSettingItem[],
  view: RadarConfig
): Partial<RadarConfig> => {
  const change: Partial<RadarConfig> = {};
  const tuning = { ...view.tuning };
  let tuningChanged = false;
  for (const item of items) {
    for (const key of item.keys ?? []) {
      (change as Record<string, unknown>)[key] = RADAR_DEFAULTS[key];
    }
    for (const key of item.tuningKeys ?? []) {
      (tuning as Record<string, unknown>)[key] = DEFAULT_RADAR_TUNING[key];
      tuningChanged = true;
    }
  }
  if (tuningChanged) change.tuning = tuning;
  return change;
};

export const matchesQuery = (
  item: RadarSettingItem,
  section: RadarSettingSection,
  query: string
) =>
  `${item.title} ${item.description ?? ''} ${section.title}`
    .toLowerCase()
    .includes(query);
