import { defineWidgetManifest } from './types';

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
});
