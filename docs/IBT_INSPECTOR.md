# Inspector playback and live capture

Enable **Dev Tool** in General settings to open the Inspector.

- Select an IBT or IRDT recording and press **Play**. The Inspector loads the recording, starts performance capture and plays it. **Stop** finishes the report and restores the previous telemetry source.
- **Load speed** controls replay throughput. **Loop entire recording** repeats the full file. Looping resets session-derived widget history at the boundary; it does not rebuild previous laps.
- **Live Capture** measures the connected simulator without replacing its telemetry source. Choose performance metrics only, or metrics plus replayable telemetry. Replayable live recording currently requires iRacing on Windows and the bundled `irsdk_replay.exe` helper. Recorded IRDT files include SDK frames and session updates and appear in the recordings list after stopping and refreshing.

Performance captures retain ten runs, at most 64 MiB and one hour each. Live telemetry retains ten `irdashies-live-*.irdt` files in the telemetry directory, at most 512 MiB and one hour each. The recorder reserves space for its final records and may stop before the size limit. Unrelated recordings are never pruned. Stopping a performance capture also stops its optional telemetry recorder.

## PresentMon

Enable **Capture iRacing frame metrics with PresentMon** and select a standalone PresentMon console executable (2.x or newer). The Intel PresentMon GUI/service and the console collector are distinct components; this integration currently uses the console collector, rather than controlling the GUI. The selected executable is kept for the current app session. No collector is downloaded automatically.

The Inspector starts an independent named ETW capture filtered to `iRacingSim64DX11.exe`. It stops only its own session, leaving existing PresentMon captures alone. Windows must grant the user permission to collect ETW performance events; collection failures appear in the Inspector.

Each performance report interval stores:

- Presented FPS, computed as 1000 divided by mean present-to-present frame time.
- Mean, p95 and p99 frame time.
- 5% low and 1% low FPS, computed as 1000 divided by the mean of the slowest 5% or 1% of frame times in that interval. These require at least 20 or 100 frames. They are interval statistics, rather than whole-run percentiles.
- CPU busy and GPU time when those CSV columns are available. Missing metrics remain unavailable.

Older 2.x CSV schemas expose CPU `FrameTime` instead of present-to-present intervals. For those schemas the Inspector uses CPU frame cadence for FPS/lows and shows an explicit notice. These must not be compared as identical metrics to present-to-present FPS.

The busiest swap chain in each interval represents the game. FPS is never summed across swap chains. The collector bounds each interval to 16,384 frames across at most 32 swap chains. Present intervals measure application presentation cadence, rather than necessarily distinct frames displayed on the monitor. ETW/stdout buffering can delay delivery relative to application CPU samples.

The graphs share elapsed capture time with CPU/memory reports. Full interval reports are retained in `samples.ndjson`; charts are downsampled to 240 points. PresentMon collection, renderer heap sampling and the Inspector itself add diagnostic overhead. The optional post-GC checkpoint can briefly pause attached renderers.

References: [PresentMon components](https://github.com/GameTechDev/PresentMon), [console flags and CSV fields](https://github.com/GameTechDev/PresentMon/blob/main/README-ConsoleApplication.md).
