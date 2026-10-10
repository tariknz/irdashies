// Uploaded images travel over IPC or WebSocket as base64 data URLs. Never
// allow these responses to select a network URL or another data MIME type.
const IMAGE_DATA_URL =
  /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const validateImageDataUrl = (value: unknown): string | null =>
  typeof value === 'string' &&
  value.length > value.indexOf(',') + 1 &&
  IMAGE_DATA_URL.test(value) &&
  value === value.trim()
    ? value
    : null;
