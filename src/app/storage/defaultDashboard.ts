import type { DashboardLayout } from '@irdashies/types';

export const defaultDashboard: DashboardLayout = {
  "widgets": [
    {
      "id": "standings",
      "enabled": true,
      "layout": {
        "x": 6,
        "y": 624,
        "width": 560,
        "height": 774
      },
      "config": {
        "iratingChange": {
          "enabled": true
        },
        "badge": {
          "enabled": true
        },
        "delta": {
          "enabled": true
        },
        "lastTime": {
          "enabled": true
        },
        "fastestTime": {
          "enabled": true
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
          "enabled": true
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
        }
      }
    },
    {
      "id": "input",
      "enabled": true,
      "layout": {
        "x": 919,
        "y": 1113,
        "width": 396,
        "height": 79
      },
      "config": {
        "trace": {
          "enabled": true,
          "includeThrottle": true,
          "includeBrake": true,
          "includeAbs": true,
          "includeSteer": true
        },
        "bar": {
          "enabled": true,
          "includeClutch": true,
          "includeBrake": true,
          "includeThrottle": true
        },
        "gear": {
          "enabled": true,
          "unit": "auto"
        },
        "steer": {
          "enabled": true
        }
      }
    },
    {
      "id": "relative",
      "enabled": true,
      "layout": {
        "x": 1720,
        "y": 940,
        "width": 402,
        "height": 256
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
          "enabled": true
        },
        "pitStatus": {
          "enabled": true
        },
        "carManufacturer": {
          "enabled": true
        },
        "badge": {
          "enabled": true
        },
        "iratingChange": {
          "enabled": false
        },
        "delta": {
          "enabled": true
        },
        "fastestTime": {
          "enabled": false
        },
        "lastTime": {
          "enabled": false
        },
        "compound": {
          "enabled": false
        }
      }
    },
    {
      "id": "map",
      "enabled": true,
      "layout": {
        "x": 1720,
        "y": 8,
        "width": 407,
        "height": 227
      },
      "config": {
        "enableTurnNames": false
      }
    },
    {
      "id": "weather",
      "enabled": true,
      "layout": {
        "x": 6,
        "y": 6,
        "width": 174,
        "height": 379
      },
      "config": {
        "backgroundOpacity": {
          "value": 25
        }
      }
    },
    {
      "id": "fastercarsfrombehind",
      "enabled": true,
      "layout": {
        "x": 910,
        "y": 7,
        "width": 405,
        "height": 43
      },
      "config": {
        "distanceThreshold": -0.3
      }
    },
    {
      "id": "fuel",
      "enabled": false,
      "layout": {
        "x": 1720,
        "y": 240,
        "width": 300,
        "height": 400
      },
      "config": {
        "fuelUnits": "L",
        "showConsumption": true,
        "showLastLap": true,
        "show3LapAvg": true,
        "show10LapAvg": true,
        "showPitWindow": true,
        "showFuelSave": true,
        "safetyMargin": 0.05,
        "background": {
          "opacity": 85
        }
      }
    }
  ],
  "generalSettings": {
    "fontSize": "sm",
    "colorPalette": "black",
    "showOnlyWhenOnTrack": false
  }
};
