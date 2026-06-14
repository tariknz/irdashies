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
      ],
      "conditions": [
        ["OS=='win'", {
          # Pin to the v143 (VS 2022 17.14) toolset. The VS 2026 (v144+)
          # compiler hits an internal compiler error (C1001) building
          # node-addon-api's napi-inl.h. The windows-latest image ships v143
          # for x64 compatibility
          # (Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64), so
          # forcing it here avoids the broken toolset without pinning the
          # runner. See actions/runner-images#14215.
          "configurations": {
            "Release": { "msbuild_toolset": "v143" },
            "Debug": { "msbuild_toolset": "v143" }
          }
        }]
      ]
    }
  ]
}
