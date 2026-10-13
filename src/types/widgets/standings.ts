import { numberOptions } from './properties';
import { defineWidgetManifest } from './types';

const timeFormatOptions = [
  { value: 'full', label: '1:42.123' },
  { value: 'mixed', label: '1:42.1' },
  { value: 'minutes', label: '1:42' },
  { value: 'seconds-full', label: '42.123' },
  { value: 'seconds-mixed', label: '42.1' },
  { value: 'seconds', label: '42' },
] as const;

export default defineWidgetManifest({
  id: 'standings',
  name: 'Standings',
  enabled: true,
  layout: {
    x: 6,
    y: 10,
    width: 560,
    height: 774,
  },
  config: {
    customClassOrdering: false,
    scale: 100,
    useLivePosition: false,
    iratingChange: {
      enabled: true,
      estimateInPractice: false,
    },
    positionChange: {
      enabled: false,
    },
    badge: {
      enabled: true,
      badgeFormat: 'license-color-rating-bw',
    },
    delta: {
      enabled: true,
    },
    gap: {
      enabled: false,
      decimalPlaces: 1,
    },
    interval: {
      enabled: false,
      decimalPlaces: 1,
    },
    lastTime: {
      enabled: true,
      timeFormat: 'full',
    },
    fastestTime: {
      enabled: true,
      timeFormat: 'full',
    },
    background: {
      opacity: 80,
    },
    foreground: {
      opacity: 70,
    },
    countryFlags: {
      enabled: true,
    },
    carNumber: {
      enabled: true,
    },
    driverName: {
      enabled: true,
      showStatusBadges: true,
      removeNumbersFromName: false,
      subtext: 'teamName',
    },
    teamName: {
      enabled: false,
      subtext: 'none',
    },
    pitStatus: {
      enabled: true,
      showPitTime: true,
      pitLapDisplayMode: 'lastPitLap',
    },
    position: {
      enabled: true,
    },
    compound: {
      enabled: true,
    },
    carManufacturer: {
      enabled: true,
      hideIfSingleMake: false,
    },
    radio: {
      persistenceSeconds: 3,
    },
    lapTimeDeltas: {
      enabled: false,
      numLaps: 3,
      decimalPlaces: 1,
    },
    avgLapTime: {
      enabled: false,
      numLaps: 5,
      timeFormat: 'mixed',
    },
    lapCount: {
      enabled: false,
    },
    classHeaderStyle: {
      estimatedLaps: {
        enabled: false,
        numLaps: 5,
      },
    },
    driverStandings: {
      buffer: 3,
      numNonClassDrivers: 3,
      minPlayerClassDrivers: 10,
      numTopDrivers: 3,
      topDriverDivider: 'theme',
    },
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
        enabled: false,
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
      'gap',
      'interval',
      'fastestTime',
      'lastTime',
      'compound',
      'lapTimeDeltas',
      'avgLapTime',
      'lapCount',
      'pushToPass',
    ],
    driverTag: { enabled: false },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
  properties: {
    customClassOrdering: {
      type: 'boolean',
      label: 'Position-based class ordering',
      description:
        "If enabled, classes are ordered based on the class's leader's overall position (does not override class colors).",
    },
    'driverStandings.buffer': {
      type: 'enum',
      control: 'select',
      label: 'Drivers to show around player',
      options: numberOptions(1, 10),
    },
    'driverStandings.numNonClassDrivers': {
      type: 'enum',
      control: 'select',
      label: 'Drivers to show in other classes',
      options: numberOptions(0, 63),
    },
    'driverStandings.minPlayerClassDrivers': {
      type: 'enum',
      control: 'select',
      label: "Minimum drivers in player's class",
      options: numberOptions(1, 63),
    },
    'driverStandings.numTopDrivers': {
      type: 'enum',
      control: 'select',
      label: "Top drivers to always show in player's class",
      options: numberOptions(0, 63),
    },
    'driverStandings.topDriverDivider': {
      type: 'enum',
      control: 'select',
      label: 'Top driver divider',
      options: [
        { value: 'none', label: 'None' },
        { value: 'theme', label: 'Theme Color' },
        { value: 'highlight', label: 'Highlight Color' },
      ],
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
    'headerBar.enabled': { type: 'boolean', label: 'Show Header Bar' },
    'footerBar.enabled': { type: 'boolean', label: 'Show Footer Bar' },
    scale: {
      type: 'number',
      label: 'Widget Scale',
      description: 'Scale the entire standings widget',
      min: 50,
      max: 200,
      step: 5,
      units: '%',
    },
    'classHeaderStyle.estimatedLaps.enabled': {
      type: 'boolean',
      label: 'Show Estimated Laps',
      description:
        "Show each class's projected total lap count in timed sessions, based on the class leader's current pace",
    },
    'classHeaderStyle.estimatedLaps.numLaps': {
      type: 'enum',
      control: 'select',
      label: 'Laps to average',
      description:
        "Median of the class leader's most recent laps — pit stops and other outlier laps are left out",
      options: numberOptions(3, 10),
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, standings will only be shown when driving',
    },
    'iratingChange.estimateInPractice': {
      type: 'boolean',
      label: 'Estimate During Practice',
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
    'avgLapTime.numLaps': {
      type: 'enum',
      label: 'Rolling Laps',
      options: numberOptions(3, 10),
    },
    'avgLapTime.timeFormat': {
      type: 'enum',
      label: 'Time Format',
      options: timeFormatOptions,
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
    'carManufacturer.hideIfSingleMake': {
      type: 'boolean',
      label: 'Hide If Single Make',
    },
    'gap.decimalPlaces': {
      type: 'enum',
      label: 'Decimal Places',
      options: numberOptions(1, 3),
    },
    'interval.decimalPlaces': {
      type: 'enum',
      label: 'Decimal Places',
      options: numberOptions(1, 3),
    },
    'driverName.subtext': {
      type: 'enum',
      control: 'select',
      label: 'Driver Name Subtext',
      options: [
        { value: 'none', label: 'None' },
        { value: 'teamName', label: 'Team Name' },
      ],
    },
    'teamName.subtext': {
      type: 'enum',
      control: 'select',
      label: 'Team Name Subtext',
      options: [
        { value: 'none', label: 'None' },
        { value: 'driverName', label: 'Driver Name' },
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
  },
});
