import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';
import { isGamepadBinding } from '@irdashies/shared';
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
 */
export class GamepadManager {
  /** Gamepad token (e.g. "gamepad:btn0") -> action it triggers. */
  private map = new Map<string, KeybindingActionId>();
  /** Lazily-created WebHID host window manager (see start). */
  private host?: GamepadHost;
  /** When set, captured pad presses are reported here instead of triggering actions (rebinding). */
  private onCapture?: (token: string) => void;

  constructor(private triggerAction: (actionId: KeybindingActionId) => void) {}

  /** Rebuild the gamepad token -> action lookup from the current bindings. */
  public syncBindings(bindings: KeybindingsMap): void {
    this.map.clear();
    for (const [actionId, entry] of Object.entries(bindings)) {
      if (isGamepadBinding(entry.accelerator)) {
        this.map.set(entry.accelerator, actionId as KeybindingActionId);
      }
    }
  }

  /**
   * Route a gamepad button-down (a `gamepad:btn<N>` token from the WebHID host)
   * to capture (rebinding) or to its bound action.
   */
  private handleButton(token: string): void {
    if (this.onCapture) {
      this.onCapture(token);
      return;
    }
    const actionId = this.map.get(token);
    if (actionId) this.triggerAction(actionId);
  }

  /**
   * Start reading game controllers via the hidden WebHID host window. Failures
   * are logged and leave keyboard bindings working.
   */
  public start(): void {
    try {
      if (!this.host) this.host = new GamepadHost();
      this.host.start((token) => this.handleButton(token));
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
    this.onCapture = onCapture;
  }

  /** Leave capture mode; pad presses resume triggering actions. */
  public stopCapture(): void {
    this.onCapture = undefined;
  }
}
