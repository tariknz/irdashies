import { describe, expect, it, vi } from 'vitest';
import { hardenWindow, isInternalAppUrl } from './hardenWindow';

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn(() => Promise.resolve()) },
}));

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const createWindow = () => {
  const handlers = new Map<string, (...args: never[]) => void>();
  let openHandler:
    | ((details: { url: string }) => { action: 'deny' } | { action: 'allow' })
    | undefined;
  return {
    window: {
      webContents: {
        setWindowOpenHandler: vi.fn((handler) => {
          openHandler = handler;
        }),
        on: vi.fn((event: string, handler: (...args: never[]) => void) => {
          handlers.set(event, handler);
        }),
      },
    } as unknown as Parameters<typeof hardenWindow>[0],
    openWindow: (url: string) => openHandler?.({ url }),
    navigate: (event: string, url: string) => {
      const preventDefault = vi.fn();
      handlers.get(event)?.(
        ...([{ preventDefault }, url] as unknown as never[])
      );
      return preventDefault;
    },
  };
};

describe('isInternalAppUrl', () => {
  it('accepts the packaged bundle', () => {
    expect(
      isInternalAppUrl(
        'file:///C:/app/renderer/index.html#/gantry',
        undefined,
        'file:///C:/app/renderer/index.html'
      )
    ).toBe(true);
  });

  it('accepts the dev server when one is configured', () => {
    expect(
      isInternalAppUrl(
        'http://localhost:5173/#/gantry',
        'http://localhost:5173'
      )
    ).toBe(true);
  });

  it('rejects the dev server origin when not in development', () => {
    expect(isInternalAppUrl('http://localhost:5173/#/gantry')).toBe(false);
  });

  it('rejects external origins', () => {
    expect(
      isInternalAppUrl('https://example.com', 'http://localhost:5173')
    ).toBe(false);
  });

  it('rejects a lookalike development origin', () => {
    expect(
      isInternalAppUrl(
        'http://localhost:5173.evil/#/gantry',
        'http://localhost:5173'
      )
    ).toBe(false);
  });

  it('rejects unrelated packaged file URLs', () => {
    expect(
      isInternalAppUrl(
        'file:///C:/Windows/System32/calc.exe',
        undefined,
        'file:///C:/app/renderer/index.html'
      )
    ).toBe(false);
  });
});

describe('hardenWindow', () => {
  it('denies popups and sends http(s) links to the system browser', () => {
    const openExternal = vi.fn();
    const { window, openWindow } = createWindow();
    hardenWindow(window, { openExternal });

    expect(openWindow('https://github.com/tariknz/irdashies')).toEqual({
      action: 'deny',
    });
    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/tariknz/irdashies'
    );
  });

  it('denies non-http popups without handing them to the browser', () => {
    const openExternal = vi.fn();
    const { window, openWindow } = createWindow();
    hardenWindow(window, { openExternal });

    expect(openWindow('file:///C:/Windows/System32/calc.exe')).toEqual({
      action: 'deny',
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it.each(['will-navigate', 'will-redirect'])('blocks external %s', (event) => {
    const { window, navigate } = createWindow();
    hardenWindow(window, { devServerUrl: 'http://localhost:5173' });

    expect(navigate(event, 'https://example.com')).toHaveBeenCalledOnce();
  });

  it.each(['will-navigate', 'will-redirect'])('allows internal %s', (event) => {
    const { window, navigate } = createWindow();
    hardenWindow(window, {
      devServerUrl: 'http://localhost:5173',
      packagedRendererUrl: 'file:///C:/app/index.html',
    });

    expect(
      navigate(event, 'http://localhost:5173/#/gantry')
    ).not.toHaveBeenCalled();
  });

  it.each(['will-navigate', 'will-redirect'])(
    'allows the expected packaged document for %s',
    (event) => {
      const { window, navigate } = createWindow();
      hardenWindow(window, {
        packagedRendererUrl: 'file:///C:/app/index.html',
      });

      expect(
        navigate(event, 'file:///C:/app/index.html#/gantry')
      ).not.toHaveBeenCalled();
      expect(
        navigate(event, 'file:///C:/other/index.html')
      ).toHaveBeenCalledOnce();
    }
  );
});
