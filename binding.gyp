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
            "target_name": "irsdk_node_replay",
            "sources": [],
            "defines": [
                "NAPI_DISABLE_CPP_EXCEPTIONS",
                "IRDASHIES_IRSDK_REPLAY_NAMES",
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
            "target_name": "irsdk_tape_node",
            "sources": [
                "src/app/irsdk/native/irsdk_node.cc",
                "src/app/irsdk/native/replay/irsdk_tape.cpp",
                "src/app/irsdk/native/replay/irsdk_tape_utils.cpp",
                "src/app/irsdk/native/lib/irsdk_defines.h",
            ],
            "defines": [
                "NAPI_DISABLE_CPP_EXCEPTIONS",
            ],
            "include_dirs": [
                "<!(node -p \"require('node-addon-api').include_dir\")",
            ],
        },
        {
            "target_name": "lmu_node",
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
                            "src/app/lmu/native/lmu_node.cc",
                            "src/app/lmu/native/lmu_source_shm.cpp",
                            "src/app/lmu/native/lmu_source.h",
                            "src/app/lmu/native/lmu_struct.h",
                        ]
                    },
                ]
            ],
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
                            "src/app/irsdk/native/replay/irsdk_replay_main.cpp",
                            "src/app/irsdk/native/replay/irsdk_tape.cpp",
                            "src/app/irsdk/native/replay/irsdk_tape.h",
                            "src/app/irsdk/native/lib/irsdk_defines.h",
                        ]
                    },
                ]
            ],
        },
        {
            "target_name": "lmu_replay",
            "type": "none",
            "sources": [],
            "conditions": [
                [
                    "OS=='win'",
                    {
                        "type": "executable",
                        "sources": [
                            "src/app/lmu/native/replay/lmu_replay_main.cpp",
                            "src/app/lmu/native/replay/lmu_tape.cpp",
                            "src/app/lmu/native/replay/lmu_tape.h",
                            "src/app/lmu/native/replay/lmu_rest_http.cpp",
                            "src/app/lmu/native/replay/lmu_rest_http.h",
                            "src/app/lmu/native/lmu_struct.h",
                        ],
                        # Winsock, for recording LMU's REST API alongside
                        # shared memory. Only this target needs it: the app
                        # reaches the same API from JS via node:http.
                        "libraries": ["-lws2_32"],
                    },
                ]
            ],
        },
        {
            "target_name": "lmu_tape_node",
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
                            "src/app/lmu/native/lmu_node.cc",
                            "src/app/lmu/native/replay/lmu_source_tape.cpp",
                            "src/app/lmu/native/replay/lmu_tape.cpp",
                            "src/app/lmu/native/replay/lmu_tape.h",
                            "src/app/lmu/native/lmu_source.h",
                            "src/app/lmu/native/lmu_struct.h",
                        ]
                    },
                ]
            ],
        }
    ]
}