import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';
import { gamepadComboToken, isGamepadBinding } from '@irdashies/shared';
import logger from '../logger';
import { GamepadHost } from './gamepadHost';

/**
 * Owns the runtime side of gamepad bindings: the token -> action lookup, the
 * record/capture mode used while rebinding, and the WebHID host lifecycle.
 *
 * It does not own the bindings themselves — the {@link KeybindingManager} pushes
 * the current map in via {@link GamepadManager.syncBindings} — and it triggers
 * actions through the `triggerAction` callback supplied at construction, so it
 * stays decoupled from how those actions are implemented.
 *
 * Buttons and d-pad directions both support combos (chords): a binding can be
 * a single token ("gamepad:btn0", "gamepad:hat0_up") or several joined with
 * '+' in canonical (sorted) order ("gamepad:btn0+gamepad:hat0_up"). A combo
 * fires the moment its exact set of controls is held — pressing an extra,
 * unrelated control breaks the match, it does not fire a 2-of-3 subset.
 */
export class GamepadManager {
  /** Canonical accelerator (single token or sorted combo) -> action it triggers. */
  private map = new Map<string, KeybindingActionId>();
  /** Controls (buttons and hat directions) currently held down. */
  private held = new Set<string>();
  /** Lazily-created WebHID host window manager (see start). */
  private host?: GamepadHost;
  /** When set, captured pad presses are reported here instead of triggering actions (rebinding). */
  private onCapture?: (token: string) => void;
  /** Tokens pressed since capture started, committed as a combo on first release. */
  private captureHeld = new Set<string>();

  constructor(private triggerAction: (actionId: KeybindingActionId) => void) {}

  /** Rebuild the gamepad token -> action lookup from the current bindings. */
  public syncBindings(bindings: KeybindingsMap): void {
    this.map.clear();
    for (const [actionId, entry] of Object.entries(bindings)) {
      if (isGamepadBinding(entry.accelerator)) {
        this.map.set(entry.accelerator, actionId as KeybindingActionId);
      }
    }
    // Rebinding invalidates whatever was held under the old map — start the
    // new map's held-set tracking from a clean slate.
    this.held.clear();
  }

  /**
   * Route a gamepad control transition (a token from the WebHID host, `down`
   * true on press / false on release) to capture (rebinding) or to its bound
   * action.
   */
  private handleButton(token: string, down: boolean): void {
    if (this.onCapture) {
      if (down) {
        this.captureHeld.add(token);
      } else if (this.captureHeld.size > 0) {
        const combo = gamepadComboToken(this.captureHeld);
        this.captureHeld.clear();
        this.onCapture(combo);
      }
      return;
    }

    if (!down) {
      this.held.delete(token);
      return;
    }
    this.held.add(token);
    const actionId = this.map.get(gamepadComboToken(this.held));
    if (actionId) this.triggerAction(actionId);
  }

  /**
   * Start reading game controllers via the hidden WebHID host window. Failures
   * are logged and leave keyboard bindings working.
   */
  public start(): void {
    try {
      if (!this.host) this.host = new GamepadHost();
      this.host.start((token, down) => this.handleButton(token, down));
    } catch (err) {
      logger.error(
        '[Gamepad] host unavailable, controller bindings disabled',
        err
      );
    }
  }

  /** Tear down the WebHID host window (call on shutdown). */
  public stop(): void {
    this.host?.stop();
  }

  /** Enter capture mode: the next pad presses are reported to `onCapture` for rebinding. */
  public startCapture(onCapture: (token: string) => void): void {
    this.captureHeld.clear();
    this.onCapture = onCapture;
  }

  /** Leave capture mode; pad presses resume triggering actions. */
  public stopCapture(): void {
    this.onCapture = undefined;
    this.captureHeld.clear();
    // Buttons held while recording may never have reached a release edge
    // here (focus, timing) — start the next non-capture run from a clean slate.
    this.held.clear();
  }
}
