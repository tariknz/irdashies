{
  "targets": [
    {
      "target_name": "irsdk_node",
      "sources": [
        "src/app/irsdk/native/irsdk_node.cc",
        "src/app/irsdk/native/lib/irsdk_utils.cpp",
        "src/app/irsdk/native/lib/yaml_parser.cpp",
        "src/app/irsdk/native/lib/irsdk_defines.h"
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
