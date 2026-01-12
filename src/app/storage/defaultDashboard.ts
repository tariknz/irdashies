import type { DashboardLayout } from '@irdashies/types';

export const defaultDashboard: DashboardLayout = {
  "widgets": [
    {
      "id": "standings",
      "enabled": true,
      "layout": {
        "x": 6,
        "y": 10,
        "width": 560,
        "height": 774
      },
      "config": {
        "iratingChange": {
          "enabled": true
        },
        "badge": {
          "enabled": true,
          "badgeFormat": "license-color-rating-bw"
        },
        "delta": {
          "enabled": true
        },
        "gap": {
          "enabled": false
        },
        "interval": {
          "enabled": false
        },
        "lastTime": {
          "enabled": true,
          "timeFormat": "full"
        },
        "fastestTime": {
          "enabled": true,
          "timeFormat": "full"
        },
        "background": {
          "opacity": 80
        },
        "countryFlags": {
          "enabled": true
        },
        "carNumber": {
          "enabled": true
        },
        "driverName": {
          "enabled": true,
          "showStatusBadges": true
        },
        "teamName": {
          "enabled": false
        },
        "pitStatus": {
          "enabled": true
        },
        "position": {
          "enabled": true
        },
        "compound": {
          "enabled": true
        },
        "carManufacturer": {
          "enabled": true
        },
        "lapTimeDeltas": {
          "enabled": false,
          "numLaps": 3
        },
        "driverStandings": {
          "buffer": 3,
          "numNonClassDrivers": 3,
          "minPlayerClassDrivers": 10,
          "numTopDrivers": 3
        },
        "titleBar": {
          "enabled": false,
          "progressBar": {
            "enabled": true
          }
        },
        "headerBar": {
          "enabled": true,
          "sessionName": {
            "enabled": true
          },
          "sessionTime": {
            "enabled": true,
            "mode": "Remaining"
          },
          "sessionLaps": {
            "enabled": true
          },
          "incidentCount": {
            "enabled": true
          },
          "brakeBias": {
            "enabled": false
          },
          "localTime": {
            "enabled": false
          },
          "sessionClockTime": {
            "enabled": false
          },
          "trackWetness": {
            "enabled": false
          },
          "airTemperature": {
            "enabled": false,
            "unit": "Metric"
          },
          "trackTemperature": {
            "enabled": false,
            "unit": "Metric"
          },
          "displayOrder": ["sessionName", "sessionTime", "sessionLaps", "incidentCount", "brakeBias", "localTime", "sessionClockTime", "trackWetness", "airTemperature", "trackTemperature"]
        },
        "footerBar": {
          "enabled": true,
          "sessionName": {
            "enabled": false
          },
          "sessionTime": {
            "enabled": false,
            "mode": "Remaining"
          },
          "sessionLaps": {
            "enabled": true
          },
          "incidentCount": {
            "enabled": false
          },
          "brakeBias": {
            "enabled": false
          },
          "localTime": {
            "enabled": true
          },
          "sessionClockTime": {
            "enabled": false
          },
          "trackWetness": {
            "enabled": true
          },
          "airTemperature": {
            "enabled": true,
            "unit": "Metric"
          },
          "trackTemperature": {
            "enabled": true,
            "unit": "Metric"
          },
          "displayOrder": ["sessionName", "sessionTime", "sessionLaps", "incidentCount", "brakeBias", "localTime", "sessionClockTime", "trackWetness", "airTemperature", "trackTemperature"]
        },
        "showOnlyWhenOnTrack": false,
        "displayOrder": ["position", "carNumber", "countryFlags", "driverName", "teamName", "pitStatus", "carManufacturer", "badge", "iratingChange", "gap", "interval", "fastestTime", "lastTime", "compound", "lapTimeDeltas"],
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "input",
      "enabled": true,
      "layout": {
        "x": 622,
        "y": 864,
        "width": 396,
        "height": 113
      },
      "config": {
        "trace": {
          "enabled": true,
          "includeThrottle": true,
          "includeBrake": true,
          "includeAbs": true,
          "includeSteer": true,
          "strokeWidth": 3,
          "maxSamples": 400
        },
        "bar": {
          "enabled": true,
          "includeClutch": true,
          "includeBrake": true,
          "includeThrottle": true,
          "includeAbs": true
        },
        "gear": {
          "enabled": true,
          "unit": "auto"
        },
        "steer": {
          "enabled": true,
          "config": {
            "style": "default",
            "color": "light"
          }
        },
        "tachometer": {
          "enabled": true,
          "showRpmText": false
        },
        "background": {
          "opacity": 80
        },
        "showOnlyWhenOnTrack": true,
        "displayOrder": ["trace", "bar", "gear", "steer"],
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "relative",
      "enabled": true,
      "layout": {
        "x": 7,
        "y": 674,
        "width": 402,
        "height": 300
      },
      "config": {
        "buffer": 3,
        "background": {
          "opacity": 80
        },
        "position": {
          "enabled": true
        },
        "carNumber": {
          "enabled": true
        },
        "countryFlags": {
          "enabled": true
        },
        "driverName": {
          "enabled": true,
          "showStatusBadges": true
        },
        "teamName": {
          "enabled": false
        },
        "pitStatus": {
          "enabled": true
        },
        "carManufacturer": {
          "enabled": true
        },
        "badge": {
          "enabled": true,
          "badgeFormat": "license-color-rating-bw"
        },
        "iratingChange": {
          "enabled": false
        },
        "delta": {
          "enabled": true,
          "precision": 2
        },
        "fastestTime": {
          "enabled": false,
          "timeFormat": "full"
        },
        "lastTime": {
          "enabled": false,
          "timeFormat": "full"
        },
        "compound": {
          "enabled": false
        },
        "displayOrder": ["position", "carNumber", "countryFlags", "driverName", "teamName", "pitStatus", "carManufacturer", "badge", "iratingChange", "delta", "fastestTime", "lastTime", "compound"],
        "titleBar": {
          "enabled": false,
          "progressBar": {
            "enabled": true
          }
        },
        "headerBar": {
          "enabled": true,
          "sessionName": {
            "enabled": true
          },
          "sessionTime": {
            "enabled": true,
            "mode": "Remaining"
          },
          "sessionLaps": {
            "enabled": true
          },
          "incidentCount": {
            "enabled": true
          },
          "brakeBias": {
            "enabled": true
          },
          "localTime": {
            "enabled": false
          },
          "sessionClockTime": {
            "enabled": false
          },
          "trackWetness": {
            "enabled": false
          },
          "precipitation": {
            "enabled": false
          },
          "airTemperature": {
            "enabled": false,
            "unit": "Metric"
          },
          "trackTemperature": {
            "enabled": false,
            "unit": "Metric"
          },
          "displayOrder": ["sessionName", "sessionTime", "sessionLaps", "incidentCount", "brakeBias", "localTime", "sessionClockTime", "trackWetness", "precipitation", "airTemperature", "trackTemperature"]
        },
        "footerBar": {
          "enabled": true,
          "sessionName": {
            "enabled": false
          },
          "sessionTime": {
            "enabled": false,
            "mode": "Remaining"
          },
          "sessionLaps": {
            "enabled": true
          },
          "incidentCount": {
            "enabled": false
          },
          "brakeBias": {
            "enabled": false
          },
          "localTime": {
            "enabled": true
          },
          "sessionClockTime": {
            "enabled": false
          },
          "trackWetness": {
            "enabled": true
          },
          "precipitation": {
            "enabled": false
          },
          "airTemperature": {
            "enabled": true,
            "unit": "Metric"
          },
          "trackTemperature": {
            "enabled": true,
            "unit": "Metric"
          },
          "displayOrder": ["sessionName", "sessionTime", "sessionLaps", "incidentCount", "brakeBias", "localTime", "sessionClockTime", "trackWetness", "precipitation", "airTemperature", "trackTemperature"]
        },
        "showOnlyWhenOnTrack": false,
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "map",
      "enabled": true,
      "layout": {
        "x": 1102,
        "y": 41,
        "width": 407,
        "height": 227
      },
      "config": {
        "enableTurnNames": false,
        "showCarNumbers": true,
        "invertTrackColors": false,
        "driverCircleSize": 40,
        "playerCircleSize": 40,
        "trackLineWidth": 20,
        "trackOutlineWidth": 40,
        "useHighlightColor": false,
        "showOnlyWhenOnTrack": false,
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "flatmap",
      "enabled": false,
      "layout": {
        "x": 622,
        "y": 700,
        "width": 800,
        "height": 150
      },
      "config": {
        "showCarNumbers": true,
        "driverCircleSize": 40,
        "playerCircleSize": 40,
        "trackLineWidth": 20,
        "trackOutlineWidth": 40,
        "invertTrackColors": false,
        "useHighlightColor": false,
        "showOnlyWhenOnTrack": false,
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "weather",
      "enabled": true,
      "layout": {
        "x": 1334,
        "y": 271,
        "width": 174,
        "height": 425
      },
      "config": {
        "background": {
          "opacity": 25
        },
        "units": "auto",
        "displayOrder": ["trackTemp", "airTemp", "wind", "humidity", "wetness", "trackState"],
        "airTemp": {
          "enabled": true
        },
        "trackTemp": {
          "enabled": true
        },
        "wetness": {
          "enabled": true
        },
        "trackState": {
          "enabled": true
        },
        "humidity": {
          "enabled": true
        },
        "wind": {
          "enabled": true
        },
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "fastercarsfrombehind",
      "enabled": true,
      "layout": {
        "x": 588,
        "y": 44,
        "width": 405,
        "height": 43
      },
      "config": {
        "distanceThreshold": -0.3,
        "sessionVisibility": { race: true, loneQualify: false, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "fuel",
      "enabled": false,
      "layout": {
        "x": 1102,
        "y": 240,
        "width": 300,
        "height": 420
      },
      "config": {
        "fuelUnits": "L",
        "layout": "vertical",
        "showConsumption": true,
        "showMin": true,
        "showLastLap": true,
        "show3LapAvg": true,
        "show10LapAvg": true,
        "showMax": true,
        "showPitWindow": true,
        "showEnduranceStrategy": false,
        "showFuelScenarios": true,
        "showFuelRequired": false,
        "showConsumptionGraph": true,
        "consumptionGraphType": "histogram",
        "safetyMargin": 0.05,
        "background": {
          "opacity": 85
        },
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "blindspotmonitor",
      "enabled": false,
      "layout": {
        "x": 378,
        "y": 102,
        "width": 800,
        "height": 500
      },
      "config": {
        "distAhead": 4.5,
        "distBehind": 4.5,
        "background": {
          "opacity": 30
        },
        "width": 20,
        "sessionVisibility": { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
      }
    },
    {
      "id": "garagecover",
      "enabled": false,
      "layout": {
        "x": 50,
        "y": 50,
        "width": 600,
        "height": 540
      },
      "config": {
        "imageFilename": ""
      }
    },
    {
      "id": "rejoin",
      "enabled": false,
      "layout": {
        "x": 378,
        "y": 102,
        "width": 800,
        "height": 500
      },
      "config": {
        "showAtSpeed": 30,
        "clearGap": 3.5,
        "careGap": 2,
        "stopGap": 1,
        "width": 20,
        "sessionVisibility": { race: true, loneQualify: false, openQualify: true, practice: true, offlineTesting: true }
      },
    },
    {
      "id": "telemetryinspector",
      "enabled": false,
      "layout": {
        "x": 50,
        "y": 50,
        "width": 250,
        "height": 200
      },
      "config": {
        "background": {
          "opacity": 80
        },
        "properties": [
          { "source": "telemetry", "path": "Speed", "label": "Speed" },
          { "source": "telemetry", "path": "SessionTime", "label": "Session Time" }
        ]
      }
    },
  ],
  "generalSettings": {
    "fontSize": "sm",
    "colorPalette": "black",
    "highlightColor": 960745,
    "skipTaskbar": true,
    "disableHardwareAcceleration": false
  }
};
