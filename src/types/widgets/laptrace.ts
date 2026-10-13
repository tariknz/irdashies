import {
  DEFAULT_AUDIO_OUTPUT_DEVICE_ID,
  DEFAULT_LAP_TRACE_COLORS,
  DEFAULT_LAP_TRACE_SOUND,
} from '../lapTrace';
import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'laptrace',
  name: 'Lap Trace',
  enabled: false,
  layout: {
    x: 622,
    y: 740,
    width: 396,
    height: 120,
  },
  config: {
    version: 1,
    referenceSource: 'best',
    metersBehind: 200,
    metersAhead: 200,
    showThrottle: true,
    showBrake: true,
    showSpeed: true,
    showGearLabels: true,
    showBrakePointMarkers: true,
    showThrottlePointMarkers: true,
    showGhost: true,
    showAbs: true,
    absStyle: 'bar',
    showAbsBar: false,
    ghostOpacity: 1,
    driverOpacity: 1,
    referenceFilled: false,
    strokeWidth: 3,
    carLineColor: '#ffffff',
    colors: DEFAULT_LAP_TRACE_COLORS,
    showLastCorner: false,
    showLastCornerTime: true,
    showLastCornerBrakeDelta: true,
    showLastCornerApexSpeed: true,
    lastCornerDisplayOrder: [
      'corner',
      'cornerTimeDelta',
      'brakePointDelta',
      'apexSpeedDelta',
    ],
    lastCornerSpeedUnit: 'auto',
    lastCornerLabelStyle: 'name',
    lastCornerFontSize: 10,
    lastCornerLatestScale: 1.4,
    lastCornerCount: 3,
    lastCornerPosition: 'bottom',
    brakeCueAudio: false,
    brakeCueOutputDeviceId: DEFAULT_AUDIO_OUTPUT_DEVICE_ID,
    brakeCueVolume: 0.6,
    brakeCueLeadSec: 0,
    brakeCueMinPeak: 0.12,
    sound: DEFAULT_LAP_TRACE_SOUND,
    brakeCueBars: false,
    brakeCueBarSide: 'right',
    brakeCueLastBar: 'top',
    background: { opacity: 0.7 },
    showOnlyWhenOnTrack: true,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
  properties: {
    referenceSource: {
      type: 'enum',
      label: 'Reference Source',
      description:
        'Which saved lap to plot. Your personal best is recorded automatically from your first clean lap on each track and car.',
      options: [
        { value: 'best', label: 'My best lap' },
        { value: 'manual', label: 'Imported .ibt lap' },
        { value: 'garage61', label: 'Garage 61 (imported lap)' },
      ],
      control: 'select',
    },
    metersAhead: {
      type: 'number',
      label: 'Distance Ahead',
      description:
        'How much track ahead of the car is visible. Set this and Distance Behind unevenly to see further in one direction than the other.',
      min: 50,
      max: 600,
      step: 50,
      units: 'm',
    },
    showThrottle: {
      type: 'boolean',
      label: 'Throttle',
      description: 'Plot the throttle trace',
    },
    showBrake: {
      type: 'boolean',
      label: 'Brake',
      description: 'Plot the brake trace',
    },
    showSpeed: {
      type: 'boolean',
      label: 'Speed',
      description: "Plot speed, scaled to the reference lap's own range",
    },
    showGearLabels: {
      type: 'boolean',
      label: 'Gear Labels',
      description:
        'Show the gear number at each shift point in the reference lap',
    },
    showBrakePointMarkers: {
      type: 'boolean',
      label: 'Brake Points',
      description:
        "A dotted vertical line through the plot at the exact point the reference (and, while you're driving, your own lap) applied and released the brake. Interpolated between telemetry samples, so it's accurate to well under a metre \u2014 finer than the trace itself can be.",
    },
    showThrottlePointMarkers: {
      type: 'boolean',
      label: 'Throttle Points',
      description:
        'A dotted vertical line through the plot at the exact point the reference got back on the throttle.',
    },
    showGhost: {
      type: 'boolean',
      label: 'Input Trace',
      description:
        'Overlay the lap you are driving now, bright, on the same axes',
    },
    showAbs: {
      type: 'boolean',
      label: 'ABS',
      description:
        'Colour your brake trace where ABS took over, the same yellow the Input widget uses',
    },
    absStyle: {
      type: 'enum',
      label: 'ABS Style',
      description:
        "'Bar' fills your brake trace down to the axis where ABS engaged, the same as the Input Trace widget, and blends colour with a filled reference trace it overlaps. 'Overlay' just colours the line.",
      options: [
        { value: 'bar', label: 'Bar (fill under curve)' },
        { value: 'overlay', label: 'Overlay' },
      ],
      control: 'select',
    },
    showAbsBar: {
      type: 'boolean',
      label: 'ABS Strip',
      description:
        'Also mark where ABS engaged as a bar beneath the traces, easier to spot than the trace colour alone',
    },
    referenceFilled: {
      type: 'boolean',
      label: 'Fill Reference Under Curve',
      description:
        'Draw the reference throttle and brake as filled bars down to the axis instead of a line',
    },
    showLastCorner: {
      type: 'boolean',
      label: 'Last Corner Panel',
      description:
        'Shows how the corners you just finished compared with the reference lap. Each result appears as you exit the corner and stays while the next few are driven, so a sequence of corners is still readable afterwards. The corner you are in holds an empty slot until you exit it. Needs the bundled track data for the circuit.',
    },
    lastCornerLabelStyle: {
      type: 'enum',
      label: 'Corner Label',
      description:
        "Name uses the track's own corner names and wraps a long one over two lines. Turn number shows T1, T2 and so on instead, which keeps the rows compact; where a complex is split into several sections both styles letter them A, B, C.",
      options: [
        { value: 'name', label: 'Name' },
        { value: 'number', label: 'Turn number' },
      ],
      control: 'select',
    },
    lastCornerSpeedUnit: {
      type: 'enum',
      label: 'Min Speed Unit',
      options: [
        { value: 'auto', label: 'Auto (follow iRacing)' },
        { value: 'km/h', label: 'km/h' },
        { value: 'mph', label: 'mph' },
      ],
      control: 'select',
    },
    lastCornerPosition: {
      type: 'enum',
      label: 'Panel Position',
      description:
        'Which edge of the graph the panel sits on. Left and right stack the corners in a column and take width from the trace, so they suit a wider widget.',
      options: [
        { value: 'bottom', label: 'Bottom' },
        { value: 'top', label: 'Top' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
      control: 'select',
    },
    lastCornerCount: {
      type: 'number',
      label: 'Corners Shown',
      description:
        'How many recent corners stay on screen. Through esses and chicanes the next corner often starts within a second, so more than one keeps a sequence readable.',
      min: 1,
      max: 5,
      step: 1,
    },
    brakeCueBars: {
      type: 'boolean',
      label: 'Countdown Bar(s)',
      description:
        "Display bar(s) that drain before your reference lap braked. Turning red at the brake point itself. Follows the reference lap's brake points; light dabs of the brake are ignored.",
    },
    brakeCueLastBar: {
      type: 'enum',
      label: 'Final Bar',
      description:
        'Which end the last bar sits at \u2014 the one that turns red at the brake point. The strip drains towards it.',
      options: [
        { value: 'top', label: 'Top' },
        { value: 'bottom', label: 'Bottom' },
      ],
    },
    brakeCueAudio: {
      type: 'boolean',
      label: 'Countdown Sound',
      description:
        'Three beeps at 3, 2 and 1 second, then a distinct tone at the brake point.',
    },
    brakeCueLeadSec: {
      type: 'number',
      label: 'Brake point cue lead',
      description:
        'Adjusts how many seconds before the braking point the audio alert will trigger. It can be used to compensate for driver reaction time.',
      min: 0,
      max: 0.6,
      step: 0.1,
      units: 's',
    },
    strokeWidth: {
      type: 'number',
      label: 'Line Thickness',
      description: 'Stroke width of the reference traces',
      min: 1,
      max: 6,
      step: 1,
    },
    lastCornerFontSize: {
      type: 'number',
      label: 'Last Corner Text Size',
      description: 'Size of the corner time and apex speed readout',
      min: 8,
      max: 24,
      step: 1,
      units: 'px',
    },
    lastCornerLatestScale: {
      type: 'number',
      label: 'Latest Corner Size',
      description:
        'How much bigger the corner you just finished is drawn relative to the older ones behind it',
      min: 1,
      max: 2.5,
      step: 0.1,
      units: '\u00d7',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, inputs will only be shown when driving',
    },
  },
});
