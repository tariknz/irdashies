{
  "targets": [
    {
      "target_name": "irsdk_node",
      "sources": [
        "src/irsdk_node.cc",
        "lib/irsdk_utils.cpp",
        "lib/yaml_parser.cpp",
        "lib/irsdk_defines.h"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
      ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include_dir\")",
      ]
    },
    {
      "target_name": "irsdk_node_replay",
      "sources": [
        "src/irsdk_node.cc",
        "lib/irsdk_utils.cpp",
        "lib/yaml_parser.cpp",
        "lib/irsdk_defines.h"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "IRDASHIES_IRSDK_REPLAY_NAMES"
      ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include_dir\")"
      ]
    },
    {
      "target_name": "irsdk_replay",
      "type": "none",
      "sources": [],
      "conditions": [
        [
          "OS=='win'",
          {
            "type": "executable",
            "sources": [
              "replay/irsdk_replay_main.cpp",
              "replay/irsdk_tape.cpp",
              "replay/irsdk_tape.h",
              "lib/irsdk_defines.h"
            ]
          }
        ]
      ]
    }
  ]
}
