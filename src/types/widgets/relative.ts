import { numberOptions } from './properties';
import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'relative',
  name: 'Relative',
  enabled: true,
  layout: {
    x: 7,
    y: 674,
    width: 402,
    height: 300,
  },
  config: {
    buffer: 3,
    useLivePosition: false,
    background: {
      opacity: 80,
    },
    foreground: {
      opacity: 70,
    },
    position: {
      enabled: true,
    },
    carNumber: {
      enabled: true,
    },
    countryFlags: {
      enabled: true,
    },
    driverName: {
      enabled: true,
      showStatusBadges: true,
      removeNumbersFromName: false,
    },
    teamName: {
      enabled: false,
    },
    pitStatus: {
      enabled: true,
      showPitTime: true,
      pitLapDisplayMode: 'lastPitLap',
    },
    carManufacturer: {
      enabled: true,
      hideIfSingleMake: false,
    },
    radio: {
      persistenceSeconds: 3,
    },
    badge: {
      enabled: true,
      badgeFormat: 'license-color-rating-bw',
    },
    iratingChange: {
      enabled: false,
    },
    positionChange: {
      enabled: false,
    },
    delta: {
      enabled: true,
      precision: 2,
    },
    fastestTime: {
      enabled: false,
      timeFormat: 'full',
    },
    lastTime: {
      enabled: false,
      timeFormat: 'full',
    },
    compound: {
      enabled: false,
    },
    lapTimeDeltas: {
      enabled: false,
      numLaps: 3,
      decimalPlaces: 1,
    },
    pushToPass: { enabled: false },
    displayOrder: [
      'position',
      'carNumber',
      'countryFlags',
      'driverName',
      'driverTag',
      'teamName',
      'pitStatus',
      'carManufacturer',
      'badge',
      'iratingChange',
      'positionChange',
      'delta',
      'fastestTime',
      'lastTime',
      'compound',
      'lapTimeDeltas',
      'pushToPass',
    ],
    driverTag: { enabled: false },
    titleBar: {
      enabled: false,
      progressBar: {
        enabled: true,
      },
    },
    headerBar: {
      enabled: true,
      sessionName: {
        enabled: true,
      },
      sessionTime: {
        enabled: true,
        mode: 'Remaining',
      },
      sessionLaps: {
        enabled: true,
      },
      incidentCount: {
        enabled: true,
      },
      brakeBias: {
        enabled: true,
      },
      localTime: {
        enabled: false,
      },
      sessionClockTime: {
        enabled: false,
      },
      trackWetness: {
        enabled: false,
      },
      precipitation: {
        enabled: false,
      },
      airTemperature: {
        enabled: false,
        unit: 'Metric',
      },
      trackTemperature: {
        enabled: false,
        unit: 'Metric',
      },
      wind: {
        enabled: false,
      },
      trackName: {
        enabled: false,
      },
      fuelLevel: {
        enabled: false,
      },
      lastLap: {
        enabled: false,
      },
      bestLap: {
        enabled: false,
      },
      topSpeed: {
        enabled: false,
      },
      manufacturerPosition: {
        enabled: false,
      },
      classRank: {
        enabled: false,
      },
      displayOrder: [
        'sessionName',
        'sessionTime',
        'sessionLaps',
        'incidentCount',
        'brakeBias',
        'localTime',
        'sessionClockTime',
        'trackWetness',
        'precipitation',
        'airTemperature',
        'trackTemperature',
        'wind',
        'trackName',
        'fuelLevel',
        'lastLap',
        'bestLap',
        'topSpeed',
        'manufacturerPosition',
        'classRank',
      ],
    },
    footerBar: {
      enabled: true,
      sessionName: {
        enabled: false,
      },
      sessionTime: {
        enabled: false,
        mode: 'Remaining',
      },
      sessionLaps: {
        enabled: true,
      },
      incidentCount: {
        enabled: false,
      },
      brakeBias: {
        enabled: false,
      },
      localTime: {
        enabled: true,
      },
      sessionClockTime: {
        enabled: false,
      },
      trackWetness: {
        enabled: true,
      },
      precipitation: {
        enabled: false,
      },
      airTemperature: {
        enabled: true,
        unit: 'Metric',
      },
      trackTemperature: {
        enabled: true,
        unit: 'Metric',
      },
      wind: {
        enabled: false,
      },
      trackName: {
        enabled: false,
      },
      fuelLevel: {
        enabled: false,
      },
      lastLap: {
        enabled: false,
      },
      bestLap: {
        enabled: false,
      },
      topSpeed: {
        enabled: false,
      },
      manufacturerPosition: {
        enabled: false,
      },
      classRank: {
        enabled: false,
      },
      displayOrder: [
        'sessionName',
        'sessionTime',
        'sessionLaps',
        'incidentCount',
        'brakeBias',
        'localTime',
        'sessionClockTime',
        'trackWetness',
        'precipitation',
        'airTemperature',
        'trackTemperature',
        'wind',
        'trackName',
        'fuelLevel',
        'lastLap',
        'bestLap',
        'topSpeed',
        'manufacturerPosition',
        'classRank',
      ],
    },
    showOnlyWhenOnTrack: false,
    hideDriversInPitStall: false,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    stylingOptions: {
      badge: false,
      statusBadges: false,
      columnHeaders: { enabled: false },
      driverPosition: { background: true },
      driverNumber: { background: true, border: true },
      flagContour: {
        enabled: false,
        borderWidth: 5,
      },
    },
  },
  properties: {
    buffer: {
      type: 'enum',
      control: 'select',
      label: 'Drivers to show around player',
      options: numberOptions(1, 10),
    },
    useLivePosition: {
      type: 'boolean',
      label: 'Use Live Position Standings',
      description:
        'If enabled, live telemetry will be used to compute driver positions. This may be less stable but will update live and not only on start/finish line.',
    },
    'radio.persistenceSeconds': {
      type: 'number',
      label: 'Radio Icon Duration',
      description:
        'How long the speaker icon keeps showing after a driver stops talking. Set to 0 to only show it while they are actively transmitting.',
      min: 0,
      max: 10,
      step: 0.5,
      units: 's',
    },
    'titleBar.enabled': { type: 'boolean', label: 'Show Title Bar' },
    'titleBar.progressBar.enabled': {
      type: 'boolean',
      label: 'Show Progress Bar',
    },
    'background.opacity': {
      type: 'number',
      label: 'Background Opacity',
      min: 0,
      max: 100,
      step: 1,
      units: '%',
    },
    'foreground.opacity': {
      type: 'number',
      label: 'Session Bar Opacity',
      min: 0,
      max: 100,
      step: 1,
      units: '%',
    },
    'delta.precision': {
      type: 'enum',
      control: 'select',
      label: 'Decimal places',
      description: 'Number of decimal places to display',
      options: numberOptions(0, 3),
    },
    'headerBar.enabled': { type: 'boolean', label: 'Show Header Bar' },
    'footerBar.enabled': { type: 'boolean', label: 'Show Footer Bar' },
    'stylingOptions.driverPosition.background': {
      type: 'boolean',
      label: 'Position Background',
      description:
        "Highlight the player's position cell with a colored background",
    },
    'stylingOptions.driverNumber.background': {
      type: 'boolean',
      label: 'Number Background',
      description: 'Show a colored background on the car number cell',
    },
    'stylingOptions.driverNumber.border': {
      type: 'boolean',
      label: 'Number Left Border',
      description: 'Show a colored left border on the car number cell',
    },
    'stylingOptions.badge': {
      type: 'boolean',
      label: 'Minimal License Badge',
      description: 'Use desaturated colors for the iRating/license badge',
    },
    'stylingOptions.statusBadges': {
      type: 'boolean',
      label: 'Minimal Status Badges',
      description:
        'Use muted borders for PIT, OUT, DNF and other status badges',
    },
    'stylingOptions.flagContour.enabled': {
      type: 'boolean',
      label: 'Show Flag Contour',
      description:
        'Draw a colored border around the widget when a session flag is active',
    },
    'stylingOptions.flagContour.borderWidth': {
      type: 'number',
      label: 'Border Width',
      description: 'Width of the flag contour border in pixels',
      min: 1,
      max: 10,
      step: 1,
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, relatives will only be shown when driving',
    },
    hideDriversInPitStall: {
      type: 'boolean',
      label: 'Hide drivers in their pit stall',
      description:
        'If enabled, drivers parked in their pit stall are removed from the relative instead of scrolling past lap after lap. Drivers driving down pit road, entering or exiting, are still shown.',
    },
    'pitStatus.showPitTime': { type: 'boolean', label: 'Pit Time' },
    'pitStatus.pitLapDisplayMode': {
      type: 'enum',
      label: 'Pitlap display mode',
      options: [
        { value: 'lastPitLap', label: 'Last pit lap' },
        { value: 'lapsSinceLastPit', label: 'Laps since last pit' },
      ],
    },
    'driverName.removeNumbersFromName': {
      type: 'boolean',
      label: 'Remove Numbers From Names',
    },
    'driverName.showStatusBadges': {
      type: 'boolean',
      label: 'Status Badges',
    },
    'carManufacturer.hideIfSingleMake': {
      type: 'boolean',
      label: 'Hide If Single Make',
    },
    'lapTimeDeltas.numLaps': {
      type: 'enum',
      label: 'Number of Laps to Show',
      options: numberOptions(1, 5),
    },
    'lapTimeDeltas.decimalPlaces': {
      type: 'enum',
      label: 'Decimal Places',
      options: numberOptions(1, 3),
    },
  },
});
