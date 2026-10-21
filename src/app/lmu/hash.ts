/**
 * FNV-1a, 32-bit.
 *
 * Not a checksum and not security — it is a cheap way to answer "is this the
 * same string as last time?" without keeping the string. Two callers want
 * exactly that: `resolveLmuTrackId` turns a track name into a stable synthetic
 * id, and the REST poller compares a response body against the previous one to
 * decide whether it is worth parsing.
 *
 * Returns an unsigned 32-bit integer.
 */
export function fnv1a32(text: string): number {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
