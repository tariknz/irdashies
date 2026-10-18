import type { Meta, StoryObj } from '@storybook/react-vite';
import { releaseNotesFixture } from '@irdashies/types';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';
import { useState } from 'react';

const meta = {
  title: 'Settings/Release notes',
  component: ReleaseNotesPanel,
  decorators: [
    (Story) => (
      <div className="max-w-3xl rounded bg-slate-800 p-6 text-white">
        <Story />
      </div>
    ),
  ],
  args: {
    version: '2.1.0',
    state: { status: 'ready', release: releaseNotesFixture(), cached: false },
  },
} satisfies Meta<typeof ReleaseNotesPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Long: Story = {
  args: {
    state: {
      status: 'ready',
      cached: false,
      release: {
        ...releaseNotesFixture(),
        body: Array.from(
          { length: 20 },
          (_, i) => `## Improvement ${i + 1}\n\n${releaseNotesFixture().body}`
        ).join('\n\n'),
      },
    },
  },
};
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const Empty: Story = {
  args: {
    state: {
      status: 'ready',
      cached: false,
      release: { ...releaseNotesFixture(), body: '' },
    },
  },
};
export const Offline: Story = {
  args: {
    state: { status: 'unavailable', reason: 'offline' },
    onRetry: () => undefined,
  },
};
export const NotPublished: Story = {
  args: { state: { status: 'unavailable', reason: 'not-found' } },
};
export const Cached: Story = {
  args: {
    state: { status: 'ready', cached: true, release: releaseNotesFixture() },
  },
};
export const UnsafeMarkdown: Story = {
  args: {
    state: {
      status: 'ready',
      cached: false,
      release: {
        ...releaseNotesFixture(),
        body: '## Safe rendering\n\n<script>alert("unsafe")</script>\n\n[Unsafe link](javascript:alert%281%29)\n\n![Remote image](https://example.com/tracking.png)\n\n[Safe link](https://github.com/tariknz/irdashies)',
      },
    },
  },
};

const DialogPreview = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-slate-600 p-3"
      >
        Open update dialog
      </button>
      {open && (
        <ReleaseNotesDialog
          version="2.1.0"
          state={{
            status: 'ready',
            release: releaseNotesFixture(),
            cached: false,
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
export const UpdateDialog: Story = { render: () => <DialogPreview /> };

/** Explicit network story using the formats present in published releases. */
export const LiveMedia: Story = {
  args: {
    state: {
      status: 'ready',
      cached: false,
      release: {
        ...releaseNotesFixture(),
        body: `## Published release images

![Lap Trace screenshot](https://github.com/user-attachments/assets/0c37a631-4651-403c-a32c-bbe872c2fa01)

<img width="1261" height="780" alt="Settings screenshot" src="https://github.com/user-attachments/assets/5b899a2b-1b99-4b70-996e-4ebdbe80ca49" />

## Animated GIF

<img width="302" height="302" alt="Animated screen recording" src="https://github.com/user-attachments/assets/283e0c59-935b-455e-809b-bc9520b6ca9d" />

## Bare GitHub video attachment

https://github.com/user-attachments/assets/d7b95d7b-16d3-4a33-a32f-eeeee1104862

## Explicit video sources

<video autoplay loop><source src="https://github.com/user-attachments/assets/d7b95d7b-16d3-4a33-a32f-eeeee1104862" type="video/mp4" /></video>

## Repository screenshot

![Team standings](https://raw.githubusercontent.com/tariknz/irdashies/06d1a0dc/docs/screenshots/pr-754/after-team.png)
`,
      },
    },
  },
};
