import { describe, expect, it } from 'vitest';
import { validateImageDataUrl } from './imageDataUrl';

describe('validateImageDataUrl', () => {
  it.each(['png', 'jpeg', 'gif', 'webp', 'svg+xml'])(
    'preserves supported %s image data URLs',
    (mime) => {
      const url = `data:image/${mime};base64,PHN2Zy8+`;
      expect(validateImageDataUrl(url)).toBe(url);
    }
  );

  it.each(['YQ==', 'YWI=', 'YWJj', 'YWJjZA=='])(
    'accepts standard base64 padding: %s',
    (payload) => {
      const url = `data:image/png;base64,${payload}`;
      expect(validateImageDataUrl(url)).toBe(url);
    }
  );

  it.each([
    null,
    undefined,
    42,
    {},
    ['data:image/png;base64,YQ=='],
    'https://example.com/image.png',
    '//example.com/image.png',
    'javascript:alert(1)',
    'file:///tmp/image.png',
    'data:text/html;base64,PHN2Zy8+',
    'data:image/svg+xml,<svg onload="alert(1)"/>',
    'data:image/png;base64,',
    'data:image/png;base64,Y',
    'data:image/png;base64,YQ=',
    'data:image/png;base64,YQ===',
    'data:image/png;base64,YQ==garbage',
    'data:image/png;base64,YQ==\n',
    'data:image/png;base64,YQ==\r',
    'data:image/png;base64,YQ==\r\n',
    ' data:image/png;base64,YQ==',
  ])('rejects unsupported or malformed input: %j', (value) => {
    expect(validateImageDataUrl(value)).toBeNull();
  });
});
