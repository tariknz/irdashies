# Gamepad input (WebHID)

Lets any keybinding be triggered by a game controller button as well as a
keyboard shortcut. Bindings live in the existing **Settings → Key Bindings**
list — click a binding to record, then press a key _or_ a controller button.

## Why WebHID (and not Electron's other options)

An iRacing overlay never holds focus — the sim does — so the input source has to
deliver presses while the app is unfocused:

- The **main process** `globalShortcut` is keyboard-only.
- The renderer's **W3C Gamepad API** (`navigator.getGamepads()`) only delivers
  input while the window is focused → useless for an overlay.
- **WebHID** (`navigator.hid`) keeps delivering input reports while unfocused,
  is built into Chromium (no extra dependency / native build), and supports
  hotplug via `connect` / `disconnect` events.

## How it works

WebHID runs in a renderer, but keybinding actions must fire even when no window
is focused or open. So a dedicated, hidden, always-alive window hosts the HID
reader and forwards presses to the main process, which triggers the bound
action (reusing the same code path as keyboard shortcuts).

```
hidden HID-host window (WebHID)         main process
  src/hidHost.ts                          gamepadHost.ts ── KeybindingManager
  getDevices() → open → inputreport   →   ipc 'gamepad:button'  → triggerAction
        │  parse button bits (hidReport.ts)        (or → capture during rebinding)
        └─ window.gamepadHost.sendButton('gamepad:btn5')
```

| File                      | Role                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `gamepadHost.ts`          | Main process. Creates the hidden window, auto-grants HID permission for its session, relays button tokens to KeybindingManager. |
| `hidReport.ts`            | Pure helpers: locate button bits in a device's HID input reports and detect press edges. Unit tested.                           |
| `../../hidHost.ts`        | The hidden renderer. Opens every HID device and emits `gamepad:btn<N>` tokens.                                                  |
| `../keybindingManager.ts` | Maps gamepad tokens to actions; handles capture during rebinding.                                                               |

## Permissions (no chooser, no user gesture)

The main process scopes two handlers to the host window's own session partition
(`hid-host`) so the default session every other window shares is untouched:

- `setPermissionCheckHandler` → allow `hid`
- `setDevicePermissionHandler` → allow `hid`

With these, `navigator.hid.getDevices()` returns the connected controllers at
startup without showing a device picker or requiring a click — so the hidden
window can read input immediately.

## Tokens

Every binding's stored value is either a keyboard accelerator (`"Alt+H"`) or a
gamepad token. WebHID exposes controller buttons **by index**, not by name. The
token also carries the device's (URL-encoded) product name when known, so the
settings UI can label the binding with the device it came from:

| Token                     | Example                       | Display                  |
| ------------------------- | ----------------------------- | ------------------------ |
| `gamepad:<device>:btn<N>` | `gamepad:Logitech%20G29:btn5` | `Logitech G29: Button 5` |
| `gamepad:btn<N>`          | `gamepad:btn5`                | `Pad: Button 5`          |

Token helpers and validation live in `src/types/keybindings.ts`.

> Button indices are per device, in HID-report declaration order. A controller's
> face button "A" and a wheel base's first button can both be `btn0`. With a
> single controller this is unambiguous; with multiple HID devices their indices
> share one namespace — a known limitation. (Re-record the binding by pressing
> the actual button you want.)
>
> Only digital buttons (HID Button usage page) are bound. Analog axes (steering,
> pedals, triggers) and POV hats are intentionally ignored so axis movement
> can't masquerade as a button press.
