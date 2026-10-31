import type { LogValue } from '../types/logBridge';

export const MAX_LOG_JSON_LENGTH = 16 * 1024;
const MAX_STRING_LENGTH = 2048;
const MAX_STACK_LENGTH = 4096;
const MAX_ENTRIES = 16;
const ERROR_FIELDS = ['name', 'message', 'code', 'stack', 'cause'] as const;

/**
 * No toJSON calls or arbitrary getters. Copy non-enumerable exception fields
 * before Electron's structured clone drops them (notably DOMException).
 * This is also used at the analytics boundary, with a path scrubber.
 */
export function serializeLogArgs(
  args: unknown[],
  scrub: (text: string) => string = (text) => text
): LogValue[] {
  const ancestors = new Set<object>();
  let nodes = 0;
  let remaining = 8192;

  const text = (value: string, limit = MAX_STRING_LENGTH): string => {
    const clean = scrub(value);
    const bounded =
      clean.length > limit
        ? `[Omitted oversized string (${clean.length} characters)]`
        : clean;
    if (bounded.length > remaining) {
      remaining = 0;
      return '[Log limit reached]';
    }
    remaining -= bounded.length;
    return bounded;
  };

  const visit = (value: unknown, depth: number): LogValue => {
    if (++nodes > 128 || remaining <= 0) return '[Log limit reached]';
    if (typeof value === 'string') return text(value);
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : String(value);
    }
    if (typeof value === 'bigint') return text(`${value}n`);
    if (typeof value !== 'object') return `[${typeof value}]`;
    if (ancestors.has(value)) return '[Circular]';
    if (depth >= 4) return '[Max depth]';

    ancestors.add(value);
    try {
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return '[Binary data omitted]';
      }
      if (Array.isArray(value)) {
        const result: LogValue[] = [];
        for (let i = 0; i < Math.min(value.length, MAX_ENTRIES); i++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, i);
          result.push(
            descriptor && 'value' in descriptor
              ? visit(descriptor.value, depth + 1)
              : '[Getter or empty slot omitted]'
          );
        }
        if (value.length > MAX_ENTRIES) result.push('[Truncated]');
        return result;
      }

      const result: Record<string, LogValue> = Object.create(null);
      // Error fields may be inherited accessors in DOMException. Only these
      // known fields are read; even hostile/proxy getters cannot break logging.
      let errorLike = value instanceof Error;
      if (!errorLike) {
        try {
          errorLike = 'name' in value && 'message' in value;
        } catch {
          return '[Unserializable]';
        }
      }
      if (errorLike) {
        for (const key of ERROR_FIELDS) {
          try {
            const field: unknown = Reflect.get(value, key);
            if (field === undefined) continue;
            if (typeof field === 'string') {
              const limit =
                key === 'stack' ? MAX_STACK_LENGTH : MAX_STRING_LENGTH;
              const clean = scrub(field);
              // Keep complete stack lines. Cutting a path midway in the
              // renderer would prevent the main process from redacting it.
              const lineEnd = clean.lastIndexOf('\n', limit - 16);
              result[key] = text(
                clean.length > limit && lineEnd > 0
                  ? `${clean.slice(0, lineEnd)}\n[Truncated]`
                  : clean,
                limit
              );
            } else {
              result[key] = visit(field, depth + 1);
            }
          } catch {
            result[key] = '[Unreadable]';
          }
        }
      }
      let count = 0;
      for (const key of Object.keys(value)) {
        if (
          errorLike &&
          ERROR_FIELDS.includes(key as (typeof ERROR_FIELDS)[number])
        )
          continue;
        if (++count > MAX_ENTRIES) {
          result['[Truncated]'] = true;
          break;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        result[text(key)] =
          descriptor && 'value' in descriptor
            ? visit(descriptor.value, depth + 1)
            : '[Getter omitted]';
      }
      return result;
    } catch {
      return '[Unserializable]';
    } finally {
      ancestors.delete(value);
    }
  };

  try {
    const result = args.slice(0, MAX_ENTRIES).map((arg) => visit(arg, 0));
    if (args.length > MAX_ENTRIES) result.push('[Truncated]');
    return JSON.stringify(result).length <= MAX_LOG_JSON_LENGTH
      ? result
      : ['[Log data exceeded size limit]'];
  } catch {
    return ['[Unserializable log data]'];
  }
}
