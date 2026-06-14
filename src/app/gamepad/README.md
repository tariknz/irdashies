# Gamepad input (@kmamal/sdl)

Lets any keybinding be triggered by a game controller button instead of (or as
well as) a keyboard shortcut. Bindings live in the existing **Settings → Key
Bindings** list — click a binding to record, then press a key _or_ a controller
button.

## Why SDL and not Electron

Electron has no way to read a controller for an overlay:

- The **main process** only exposes `globalShortcut` (keyboard accelerators).
- The **renderer**'s W3C Gamepad API (`navigator.getGamepads()`) only delivers
  input while the window is focused. An iRacing overlay never holds focus — the
  sim does — so it receives nothing.

[`@kmamal/sdl`](https://github.com/kmamal/node-sdl) wraps SDL and reads
controller input even while the app is unfocused, with hotplug, no window
required. It ships prebuilt N-API binaries (ABI-stable across Node and Electron,
so no native rebuild) — no SDL toolchain or vendoring needed.

## Pieces

| File                      | Role                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `gamepadManager.ts`       | Opens devices via `@kmamal/sdl` and forwards button presses.                           |
| `../keybindingManager.ts` | Maps gamepad tokens (`gamepad:<button>`) to actions; handles capture during rebinding. |

## Devices: controllers vs. raw joysticks

Every SDL device is a joystick; some are additionally recognized as **game
controllers** with a named-button mapping. GamepadManager prefers the controller
API for readable names and falls back to the raw joystick API otherwise — for
wheel bases, pedals, unrecognized pads, and recognized pads whose controller
mapping fails to open (e.g. a Logitech F710 in DirectInput mode throwing
`0 hats`).

Token shapes (stored as `gamepad:<button>`):

| Source                                      | Token          | Example                       | Display       |
| ------------------------------------------- | -------------- | ----------------------------- | ------------- |
| Game controller button                      | named          | `gamepad:a`, `gamepad:dpadUp` | `Pad: A`      |
| Controller trigger (analog, edge-triggered) | named          | `gamepad:leftTrigger`         | `Pad: LT`     |
| Raw joystick button                         | `button<N>`    | `gamepad:button5`             | `Pad: Btn 5`  |
| Raw joystick POV hat                        | `hat<N>_<dir>` | `gamepad:hat0_up`             | `Pad: POV Up` |

A binding's stored value is either a keyboard accelerator (`"Alt+H"`) or one of
the gamepad tokens above. Helpers and validation live in
`src/types/keybindings.ts` (named buttons match @kmamal/sdl's `Controller.Button`).

> Raw joystick buttons are indexed per device; with multiple raw joysticks the
> indices share one namespace (device A's `button0` == device B's `button0`).
> Fine for a single wheel; a known limitation otherwise.

## Build / packaging notes

- `@kmamal/sdl` is a runtime dependency; it is marked `external` in
  `vite.main.config.ts` so it loads from `node_modules` instead of being bundled.
- `AutoUnpackNativesPlugin` (in `forge.config.ts`) unpacks its `.node` binary
  from the asar in packaged builds.
- The native addon is loaded lazily (see `KeybindingManager.startGamepad`) so SDL
  stays out of the module graph for tests and unused sessions.
