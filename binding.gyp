{
    "targets": [
        {
            "target_name": "irsdk_node",
            "sources": [],
            "defines": [
                "NAPI_DISABLE_CPP_EXCEPTIONS",
            ],
            "include_dirs": [
                "<!(node -p \"require('node-addon-api').include_dir\")",
            ],
            "conditions": [
                [
                    "OS=='win'",
                    {
                        "sources": [
                            "src/app/irsdk/native/irsdk_node.cc",
                            "src/app/irsdk/native/lib/irsdk_utils.cpp",
                            "src/app/irsdk/native/lib/yaml_parser.cpp",
                            "src/app/irsdk/native/lib/irsdk_defines.h",
                        ]
                    },
                ]
            ],
        },
        {
            "target_name": "vr_overlay",
            "sources": [],
            "defines": [
                "NAPI_DISABLE_CPP_EXCEPTIONS",
            ],
            "include_dirs": [
                "<!(node -p \"require('node-addon-api').include_dir\")",
                "native/shared",
            ],
            "conditions": [
                [
                    "OS=='win'",
                    {
                        "sources": [
                            "src/app/vr/native/vr_overlay.cc",
                        ],
                        "libraries": [
                            "d3d11.lib",
                            "dxgi.lib",
                        ],
                    },
                ]
            ],
        }
    ]
}
