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
    }
  ]
}
