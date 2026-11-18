import { channelRegistry } from '@irdashies/types';
import type { WidgetPreviewRequest } from '@irdashies/types';

/** The frame can request only registered channels at their supported rates. */
export function parsePreviewRequest(
  value: unknown
): WidgetPreviewRequest | undefined {
  if (!value || typeof value !== 'object' || !('type' in value)) return;
  if (value.type === 'preview:ready') return { type: 'preview:ready' };
  if (value.type === 'preview:asset') {
    if (
      !('kind' in value) ||
      (value.kind !== 'garageCover' && value.kind !== 'playerIcon') ||
      !('filename' in value) ||
      typeof value.filename !== 'string' ||
      value.filename.length > 255 ||
      !('requestId' in value) ||
      typeof value.requestId !== 'number' ||
      !Number.isSafeInteger(value.requestId) ||
      value.requestId < 0
    )
      return;
    return {
      type: value.type,
      kind: value.kind,
      filename: value.filename,
      requestId: value.requestId,
    };
  }
  if (
    value.type !== 'preview:subscribe' &&
    value.type !== 'preview:unsubscribe'
  )
    return;
  if (
    !('channel' in value) ||
    typeof value.channel !== 'string' ||
    !Object.hasOwn(channelRegistry, value.channel)
  )
    return;
  const channel = value.channel as keyof typeof channelRegistry;
  if (value.type === 'preview:unsubscribe')
    return { type: value.type, channel };
  const rate = 'rate' in value ? value.rate : undefined;
  const definition = channelRegistry[channel];
  if (
    rate !== undefined &&
    (typeof rate !== 'number' ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      definition.kind !== 'snapshot' ||
      rate > definition.maxRateHz)
  )
    return;
  return { type: value.type, channel, rate };
}
