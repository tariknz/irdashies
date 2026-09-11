/**
 * Typed error for .ibt import failures.
 *
 * The `code` lets the renderer show a specific message (bad file vs. missing
 * channels vs. no valid lap) without string-matching, and keeps the raw file
 * path out of anything user-facing (R11.4).
 */
export type IbtImportErrorCode =
  | 'unreadable'
  | 'bad-signature'
  | 'unsupported-version'
  | 'truncated'
  | 'missing-channels'
  | 'no-session-info'
  | 'no-valid-lap'
  | 'lap-too-large';

export class IbtImportError extends Error {
  readonly code: IbtImportErrorCode;

  constructor(code: IbtImportErrorCode, message: string) {
    super(message);
    this.name = 'IbtImportError';
    this.code = code;
  }
}
