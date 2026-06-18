# Gamepad input (WebHID)

Any keybinding fire from controller button too, not just keyboard. Bindings live in **Settings → Key Bindings**. Click binding to record, press key _or_ pad button.

Code-level detail (token grammar, permissions, parsing, hat decoding) live in the file-header JSDoc of `hidHost.ts`, `gamepadHost.ts`, `gamepadToken.ts`, `hidReport.ts`. This file only keep the design rationale that isn't obvious from the code.

## Why WebHID (not other Electron options)

iRacing overlay never hold focus — sim hold it. Input source must deliver presses while app unfocused:

- Main process `globalShortcut`: keyboard only.
- Renderer **W3C Gamepad API** (`navigator.getGamepads()`): delivers input only while window focused → useless for overlay.
- **WebHID** (`navigator.hid`): keeps delivering input reports while unfocused. Built into Chromium (no extra dependency / native build). Hotplug via `connect` / `disconnect` events.

So one hidden, always-alive window host the HID reader and forward presses to the main process, which fire the bound action through the same `triggerAction` path as keyboard shortcuts.

## Why single-bit-only, no usage-page filter

`parseButtons` keep **every non-constant, single-bit field** — no usage-page filter.

- Many controllers and sim wheel bases (Thrustmaster, Fanatec, Simucube) declare buttons on a **vendor-defined** page (`0xFF00`+), not the standard Button page (`0x09`). Filtering by page drop those — exactly what broke a real Thrustmaster wheel. An unbound bit fire nothing (`GamepadManager` only trigger mapped tokens), so no need to guess which bits are "real" buttons.
- Single-bit is the safety line. Analog axes are multi-bit (`reportSize > 1`), so a turned wheel or pressed pedal can't reach the binding map. The overlay run during a race — firing an action by accident (analog drift, a status flag toggling mid-corner) is worse than a missing feature.

## Hat switch (d-pad)

Pads report the d-pad as one multi-bit **hat switch** (Generic Desktop usage `0x39`), not four bits, so `parseButtons` never see it. `parseHats` find it; `hatEdges` decode directions clockwise from the descriptor's logical minimum (= up), which handles both `0-7` and `1-8` pads.

> **Assumption left:** directions read clockwise from `logicalMin`. Matches every pad seen. A device ordering its hat differently would map wrong — fix point is the `HAT_DIRECTIONS` order in `hidReport.ts`.

## Future

Analog-axis binding need a different contract (threshold/deadzone/hysteresis + new token grammar e.g. `gamepad:axisRx+>0.5`). Deferred until concrete need — mapping a continuous axis to a discrete action is mostly an accidental-trigger generator.
