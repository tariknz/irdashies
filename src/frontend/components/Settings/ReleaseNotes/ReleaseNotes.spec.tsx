import {
  act,
  fireEvent,
  render as renderRaw,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseNotesBridge } from '@irdashies/types';
import { releaseNotesFixture } from '@irdashies/types';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { ReleaseNotesAnnouncement } from './ReleaseNotesAnnouncement';
import { ReleaseNotesSettings } from './ReleaseNotesSettings';
import { ReleaseNotesStatusProvider } from './ReleaseNotesStatusContext';
import type { ReactElement } from 'react';

const render = (element: ReactElement) =>
  renderRaw(element, { wrapper: ReleaseNotesStatusProvider });

const release = releaseNotesFixture();
const ready = { status: 'ready' as const, release, cached: false };
let bridge: ReleaseNotesBridge;
beforeEach(() => {
  // jsdom does not implement modal dialog. Browser interaction is verified separately.
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement
  ) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
  bridge = {
    getStatus: vi.fn().mockResolvedValue({
      currentVersion: '2.1.0',
      availableVersion: null,
      pendingVersion: '2.1.0',
      unreadVersion: '2.1.0',
      autoShow: true,
      development: true,
      simulation: false,
    }),
    getRelease: vi.fn().mockResolvedValue(ready),
    dismiss: vi.fn().mockResolvedValue(undefined),
    setAutoShow: vi.fn().mockResolvedValue(undefined),
  };
  window.releaseNotesBridge = bridge;
});
afterEach(() => {
  cleanup();
  delete window.releaseNotesBridge;
});

describe('safe release notes rendering', () => {
  it('renders Markdown features, blocks unsafe HTML/URLs and untrusted media', () => {
    const { container } = render(
      <ReleaseNotesPanel
        version="2.1.0"
        state={{
          ...ready,
          release: {
            ...release,
            body: '## Changes\n\n- **Better** overlays\n\n<script>window.alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)\n\n[Safe](https://github.com/tariknz/irdashies)\n\n![Tracking](https://example.com/image.png)',
          },
        }}
      />
    );
    expect(
      screen.getByRole('heading', { name: 'Changes' })
    ).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('Better');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Unsafe' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Safe' })).toHaveAttribute(
      'target',
      '_blank'
    );
  });
  it('renders empty notes and a recoverable failure', () => {
    const { rerender } = render(
      <ReleaseNotesPanel
        version="2.1.0"
        state={{ ...ready, release: { ...release, body: '' } }}
      />
    );
    expect(
      screen.getByText('No release notes were included for this version.')
    ).toBeInTheDocument();
    const retry = vi.fn();
    rerender(
      <ReleaseNotesPanel
        version="2.1.0"
        state={{ status: 'unavailable', reason: 'offline' }}
        onRetry={retry}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('Settings-only upgrade announcement', () => {
  it('loads pending installed version and acknowledges only after notes are loaded and closed', async () => {
    render(<ReleaseNotesAnnouncement />);
    await screen.findByText("What's new in v2.1.0");
    await screen.findByText('Standings and relative overlays');
    expect(bridge.dismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(bridge.dismiss).toHaveBeenCalledWith('2.1.0'));
    expect(screen.queryByText("What's new in v2.1.0")).toBeNull();
  });
  it('does not mark a failed fetch as viewed; retries and handles Escape', async () => {
    vi.mocked(bridge.getRelease).mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'offline',
    });
    const { unmount } = render(<ReleaseNotesAnnouncement />);
    await screen.findByText(
      'Could not load release notes. Check your connection and try again.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Standings and relative overlays');
    expect(bridge.getRelease).toHaveBeenCalledTimes(2);
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: true, cancelable: true })
    );
    await waitFor(() => expect(bridge.dismiss).toHaveBeenCalledOnce());
    unmount();
    vi.mocked(bridge.getRelease).mockResolvedValue({
      status: 'unavailable',
      reason: 'offline',
    });
    render(<ReleaseNotesAnnouncement />);
    await screen.findByText(
      'Could not load release notes. Check your connection and try again.'
    );
    vi.mocked(bridge.dismiss).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(bridge.dismiss).not.toHaveBeenCalled();
  });
  it('retries pending notes after Settings becomes visible again, without ordinary focus nagging', async () => {
    vi.mocked(bridge.getRelease).mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'offline',
    });
    render(<ReleaseNotesAnnouncement />);
    await screen.findByText(
      'Could not load release notes. Check your connection and try again.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(bridge.dismiss).not.toHaveBeenCalled();
    fireEvent.focus(window);
    expect(screen.queryByText("What's new in v2.1.0")).toBeNull();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByText('Standings and relative overlays');
  });
  it('suppresses announcement when auto-show is disabled', async () => {
    vi.mocked(bridge.getStatus).mockResolvedValue({
      currentVersion: '2.1.0',
      availableVersion: null,
      pendingVersion: '2.1.0',
      unreadVersion: '2.1.0',
      autoShow: false,
      development: true,
      simulation: false,
    });
    await act(async () => {
      render(<ReleaseNotesAnnouncement />);
    });
    expect(screen.queryByText("What's new in v2.1.0")).toBeNull();
    expect(bridge.getRelease).not.toHaveBeenCalled();
  });
  it('keeps preview available in development without acknowledging the installed release', async () => {
    vi.mocked(bridge.getStatus).mockResolvedValue({
      currentVersion: '2.1.0',
      availableVersion: null,
      pendingVersion: null,
      unreadVersion: null,
      autoShow: true,
      development: true,
      simulation: false,
    });
    render(<ReleaseNotesSettings />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview update dialog' })
    );
    expect(screen.getByText('Release notes preview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(bridge.dismiss).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Show release notes after updates' })
    );
    await waitFor(() => expect(bridge.setAutoShow).toHaveBeenCalledWith(false));
  });
});

describe('release note images and videos', () => {
  const image =
    'https://github.com/user-attachments/assets/5b899a2b-1b99-4b70-996e-4ebdbe80ca49';
  const video =
    'https://github.com/user-attachments/assets/d7b95d7b-16d3-4a33-a32f-eeeee1104862';
  const bodyPanel = (body: string) =>
    render(
      <ReleaseNotesPanel
        version="2.1.0"
        state={{ ...ready, release: { ...release, body } }}
      />
    );

  it('renders actual Markdown and GitHub HTML image formats including GIFs', () => {
    bodyPanel(
      `![Screenshot](${image})\n\n<img width="1261" height="780" alt="Settings" src="${image}" />\n\n<img src="https://github.com/user-attachments/assets/283e0c59-935b-455e-809b-bc9520b6ca9d" alt="Animated recording" />`
    );
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByRole('img', { name: 'Settings' })).toHaveAttribute(
      'src',
      image
    );
    expect(screen.getByRole('img', { name: 'Settings' })).not.toHaveAttribute(
      'width'
    );
    expect(
      screen.getByRole('img', { name: 'Animated recording' })
    ).toHaveAttribute('loading', 'lazy');
    expect(screen.getAllByRole('link', { name: 'Open image' })).toHaveLength(3);
  });

  it('renders bare extensionless video attachment URLs with controls and no autoplay', () => {
    const { container } = bodyPanel(`## Video\n\n${video}`);
    const element = container.querySelector('video');
    expect(element).toHaveAttribute('src', video);
    expect(element).toHaveAttribute('controls');
    expect(element).toHaveAttribute('preload', 'metadata');
    expect(element).not.toHaveAttribute('autoplay');
    expect(
      screen.getByRole('link', { name: 'Open attachment' })
    ).toHaveAttribute('href', video);
  });

  it('preserves the video element across page status refreshes', () => {
    const body = video;
    const { container, rerender } = bodyPanel(body);
    const element = container.querySelector('video');
    expect(element).not.toBeNull();
    rerender(
      <ReleaseNotesPanel
        version="2.1.0"
        state={{ ...ready, cached: true, release: { ...release, body } }}
      />
    );
    expect(container.querySelector('video')).toBe(element);
  });

  it('supports sanitized HTML video/source and ignores autoplay, scripts and event handlers', () => {
    const { container } = bodyPanel(
      `<video autoplay loop onplay="alert(1)" style="position:fixed" poster="javascript:alert(1)"><source src="${video}" type="video/mp4" onerror="alert(1)" /><source src="javascript:alert(1)" /></video>\n\n<img alt="Safe image" src="${image}" onerror="alert(1)" />\n\n<script>alert(1)</script><iframe src="https://example.com"></iframe>`
    );
    const element = container.querySelector('video');
    expect(element).toHaveAttribute('controls');
    expect(element).not.toHaveAttribute('autoplay');
    expect(element).not.toHaveAttribute('loop');
    expect(element).not.toHaveAttribute('style');
    expect(element).not.toHaveAttribute('onplay');
    expect(element).not.toHaveAttribute('poster');
    expect(container.querySelectorAll('source')).toHaveLength(1);
    expect(container.querySelector('source')).toHaveAttribute('src', video);
    expect(container.querySelector('source')).not.toHaveAttribute('onerror');
    expect(screen.getByRole('img', { name: 'Safe image' })).not.toHaveAttribute(
      'onerror'
    );
    expect(container.querySelector('script, iframe')).toBeNull();
  });

  it('falls back from ambiguous attachment video to image, then to a visible external link', () => {
    const { container } = bodyPanel(image);
    const element = container.querySelector('video');
    if (!element)
      throw new Error('Expected ambiguous attachment video attempt');
    fireEvent.error(element);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', image);
    fireEvent.error(img);
    expect(
      screen.getByText(
        'Media could not be loaded. Open it on GitHub to view it.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open image' })).toHaveAttribute(
      'href',
      image
    );
  });

  it('shows fallback when an explicit video fails, and keeps media inline with valid paragraph markup', () => {
    const { container } = bodyPanel(
      `Text <video src="${video}"></video> and ![Screenshot](${image}).`
    );
    const element = container.querySelector('video');
    if (!element) throw new Error('Expected video');
    fireEvent.error(element);
    expect(screen.getByRole('link', { name: 'Open video' })).toHaveAttribute(
      'href',
      video
    );
    expect(container.querySelector('p div, p p')).toBeNull();
  });

  it('shows fallback when all explicit video sources fail', () => {
    const { container } = bodyPanel(
      `<video><source src="${video}" type="video/mp4" /></video>`
    );
    const source = container.querySelector('source');
    if (!source) throw new Error('Expected source');
    fireEvent.error(source);
    expect(
      screen.getByText(
        'Media could not be loaded. Open it on GitHub to view it.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open video' })).toHaveAttribute(
      'href',
      video
    );
  });

  it('blocks untrusted media hosts and unsafe source protocols while keeping links usable', () => {
    const { container } = bodyPanel(
      `<img src="javascript:alert(1)" alt="Bad scheme" /><img src="https://example.com/tracker.png" alt="Other host" /><video src="file:///private/video.mp4"></video>\n\n[Normal link](https://example.com)`
    );
    expect(container.querySelector('img, video, source')).toBeNull();
    expect(screen.getByRole('link', { name: 'Normal link' })).toHaveAttribute(
      'href',
      'https://example.com/'
    );
  });

  it('renders a linked screenshot without nesting external links', () => {
    const { container } = bodyPanel(
      `[![Screenshot](${image})](https://github.com/tariknz/irdashies)`
    );
    expect(screen.getByRole('img', { name: 'Screenshot' })).toBeInTheDocument();
    expect(container.querySelector('a a')).toBeNull();
  });
});
