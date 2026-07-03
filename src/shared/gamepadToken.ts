import { HAT_DIRECTIONS, type ParsedGamepadToken } from '@irdashies/types';

/** Prefix marking a binding value as a gamepad button rather than a keyboard accelerator. */
export const GAMEPAD_TOKEN_PREFIX = 'gamepad:';

/**
 * Gamepad control token grammar:
 *
 *   gamepad:btn<N>                 button index N, device unknown
 *   gamepad:<device>:btn<N>        button index N on a named device
 *   gamepad:hat<N>_<dir>           hat (d-pad) N in direction <dir>
 *   gamepad:<device>:hat<N>_<dir>  hat N on a named device
 *
 * N is the control's zero-based index within the device's HID input report
 * (WebHID exposes controls by index, not name). `<dir>` is a hat direction such
 * as `up` or `downright`. The control id never contains a raw ':' (hats use
 * '_'), and `<device>` is the URL-encoded product name — so a single ':' always
 * separates the optional device from the control.
 */
// Hat suffix restricted to the 8 known HID directions — rejects junk like `hat0_unknown`.
const GAMEPAD_CONTROL_RE = new RegExp(
  `^(btn\\d+|hat\\d+_(?:${HAT_DIRECTIONS.join('|')}))$`
);

/** True when a binding value refers to a gamepad control. */
export function isGamepadBinding(accelerator: string): boolean {
  return accelerator.startsWith(GAMEPAD_TOKEN_PREFIX);
}

function gamepadToken(control: string, deviceName?: string): string {
  return deviceName
    ? `${GAMEPAD_TOKEN_PREFIX}${encodeURIComponent(deviceName)}:${control}`
    : `${GAMEPAD_TOKEN_PREFIX}${control}`;
}

/**
 * Build a gamepad token from a button index and (optionally) the device's
 * product name, e.g. (5, "Logitech G29") -> "gamepad:Logitech%20G29:btn5",
 * or (5) -> "gamepad:btn5".
 */
export function gamepadTokenFromIndex(
  index: number,
  deviceName?: string
): string {
  return gamepadToken(`btn${index}`, deviceName);
}

/**
 * Build a gamepad token from a hat index + direction and (optionally) the
 * device's product name, e.g. (0, "up", "Xbox") -> "gamepad:Xbox:hat0_up".
 */
export function gamepadTokenFromHat(
  index: number,
  direction: string,
  deviceName?: string
): string {
  return gamepadToken(`hat${index}_${direction}`, deviceName);
}

/** Parse a gamepad token into its device + control parts, or null if invalid. */
export function parseGamepadToken(token: string): ParsedGamepadToken | null {
  if (!isGamepadBinding(token)) return null;
  const body = token.slice(GAMEPAD_TOKEN_PREFIX.length);

  const sep = body.lastIndexOf(':');
  if (sep === -1) {
    return GAMEPAD_CONTROL_RE.test(body) ? { button: body } : null;
  }

  const button = body.slice(sep + 1);
  if (!GAMEPAD_CONTROL_RE.test(button)) return null;

  const encoded = body.slice(0, sep);
  let device: string | undefined;
  try {
    device = decodeURIComponent(encoded) || undefined;
  } catch {
    device = encoded || undefined;
  }
  return { device, button };
}

/**
 * Separator joining individual gamepad tokens into a combo (chord) accelerator,
 * e.g. "gamepad:btn0+gamepad:btn5". Safe to split on: every token's encoded
 * device segment runs through `encodeURIComponent`, which escapes '+' (it is
 * not in the unreserved set), so a literal '+' never appears inside a token.
 */
const COMBO_SEPARATOR = '+';

/**
 * Split a gamepad accelerator (single token or combo) into its individual
 * tokens, validating each one. Returns null if `accelerator` isn't a gamepad
 * binding, any part fails to parse, or the combo isn't in canonical form.
 *
 * The runtime lookup keys actions by `gamepadComboToken` (sorted + deduped),
 * so a non-canonical combo like "gamepad:btn5+gamepad:btn0" or a duplicate
 * "gamepad:btn0+gamepad:btn0" would validate here yet never fire — reject it.
 */
export function parseGamepadTokens(accelerator: string): string[] | null {
  if (!isGamepadBinding(accelerator)) return null;
  const parts = accelerator.split(COMBO_SEPARATOR);
  if (!parts.every((part) => parseGamepadToken(part))) return null;
  return gamepadComboToken(parts) === accelerator ? parts : null;
}

/**
 * Build a canonical combo accelerator from a set of gamepad tokens, sorted so
 * the binding is independent of press order (the same chord always produces
 * the same string, however its buttons were pressed). A single token round
 * -trips unchanged, so this also covers plain (non-combo) bindings.
 */
export function gamepadComboToken(tokens: Iterable<string>): string {
  return [...new Set(tokens)].sort().join(COMBO_SEPARATOR);
}
