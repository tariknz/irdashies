# Native capture safety regression tests

Run from the repository root with Clang (no Node, simulator, or Windows SDK
required):

```sh
mkdir -p build/native-tests
clang++ -std=c++17 -Wall -Wextra -Werror -g \
  -fsanitize=address,undefined -fno-omit-frame-pointer \
  src/app/irsdk/native/tests/irsdk_capture_test.cpp \
  -o build/native-tests/irsdk_capture_test
ASAN_OPTIONS=detect_leaks=0 UBSAN_OPTIONS=halt_on_error=1 \
  build/native-tests/irsdk_capture_test
```

LeakSanitizer is disabled because Apple's ASan runtime does not support it.
Without sanitizer support, omit the sanitizer flags and environment variables.
The test source also builds as a standalone C++17 program on Windows; it is not
part of the shipped addon.

The tests exercise the same capture core used by `irsdk_utils.cpp`. A bounded
mapping reader deterministically changes the producer header and descriptors
between individual reads, including between validation and the frame copy.
They cover allocation growth/shrinkage, spare capacity versus captured length,
paused frames, backward ticks, disconnect/reconnect, layout replacement at the
same tick, invalid/overlapping ranges, negative and overflowing descriptor
fields, invalid bool metadata, stable retries, exhausted retries, polling and
read failures. Invalid or torn captures must never expose readable telemetry.
These are simulated mapping transitions, not an iRacing runtime reproduction.

After building the addon, also run:

```sh
npx vitest run --no-coverage \
  src/app/irsdk/native/irsdk-tape-node.spec.ts \
  src/app/irsdk/native/irsdk-replay.spec.ts
```

On macOS, the current node-gyp configuration may need `CXXFLAGS=-std=c++17`
when building the existing tape targets. The tape tests exercise the N-API
surface on all platforms, including session versions, stop/restart, raw values,
metadata strings and fail-safe rejection of malformed descriptors. The shared
memory integration test in `irsdk-replay.spec.ts` requires Windows and is skipped
elsewhere. Portable tests do not validate Win32 mapping/event behavior or the
Windows recorder executable.

## Windows validation

From an x64 Visual Studio Developer Command Prompt, build the addon and run
both native integration suites:

```bat
npm run irsdk:build
npx vitest run --no-coverage src/app/irsdk/native/irsdk-tape-node.spec.ts src/app/irsdk/native/irsdk-replay.spec.ts
```

Run the capture core with MSVC AddressSanitizer:

```bat
if not exist build\native-tests mkdir build\native-tests
cl /nologo /std:c++17 /EHsc /W4 /Zi /fsanitize=address src\app\irsdk\native\tests\irsdk_capture_test.cpp /Fe:build\native-tests\irsdk_capture_test.exe /Fo:build\native-tests\irsdk_capture_test.obj /Fd:build\native-tests\irsdk_capture_test.pdb
build\native-tests\irsdk_capture_test.exe
```

Validated on 17 October 2026 with Windows x64, Node 24.16.0 and Visual Studio
2026 Build Tools 18.7: the native build completed, the AddressSanitizer capture
tests passed, and both Vitest suites passed (13 tests, none skipped). This
includes the isolated Win32 mapping/event replay boundary and paused-tick
heartbeat. The recorder executable compiled; live iRacing capture and recorder
runtime behavior were not exercised. MSVC reported C4996 for the fixed literal
`strcpy` in the test fixture; the test completed without sanitizer findings.

## Tape replay header regression

This standalone test links the actual tape backend and checks that a published
frame's source tick reaches both the replay header and the captured header.
It covers the first and last buffer slots, startup resets, invalid slot indices
and polling without a capture buffer. Invalid slots still publish frame data
without indexing or changing the buffer headers.

With Clang, from the repository root:

```sh
mkdir -p build/native-tests
clang++ -std=c++17 -Wall -Wextra -Werror -g \
  -fsanitize=address,undefined -fno-omit-frame-pointer \
  src/app/irsdk/native/tests/irsdk_tape_header_test.cpp \
  src/app/irsdk/native/replay/irsdk_tape_utils.cpp \
  src/app/irsdk/native/replay/irsdk_tape.cpp \
  -o build/native-tests/irsdk_tape_header_test
ASAN_OPTIONS=detect_leaks=0 UBSAN_OPTIONS=halt_on_error=1 \
  build/native-tests/irsdk_tape_header_test build/native-tests/header-test.irdt
```

Or in an x64 Visual Studio Developer Command Prompt:

```bat
if not exist build\native-tests mkdir build\native-tests
cl /nologo /std:c++17 /EHsc /W4 /Zi /fsanitize=address src\app\irsdk\native\tests\irsdk_tape_header_test.cpp src\app\irsdk\native\replay\irsdk_tape_utils.cpp src\app\irsdk\native\replay\irsdk_tape.cpp /Fe:build\native-tests\irsdk_tape_header_test.exe /Fo:build\native-tests\ /Fd:build\native-tests\irsdk_tape_header_test.pdb
build\native-tests\irsdk_tape_header_test.exe build\native-tests\header-test.irdt
```

The fixture path is written and removed by the test; use a disposable path.
