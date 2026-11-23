import type { ReactNode } from 'react';
import { useDashboard } from '@irdashies/context';
import type { BroadcastTransition } from '@irdashies/types';
import { SettingSelectRow } from '../components/SettingSelectRow';
import {
  broadcastTransition,
  broadcastTransitionChanged,
} from '../broadcastModules';
import { BroadcastHeading } from './BroadcastHeading';

const TRANSITION_OPTIONS: { label: string; value: BroadcastTransition }[] = [
  { label: 'Random', value: 'random' },
  { label: 'Slide Left', value: 'slide-left' },
  { label: 'Slide Right', value: 'slide-right' },
  { label: 'Slide Up', value: 'slide-up' },
  { label: 'Fade', value: 'fade-in' },
  { label: 'Flip', value: 'flip' },
  { label: 'Wipe', value: 'wipe' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Checker', value: 'checker' },
];

export const BroadcastTransitionSettings = ({
  children,
}: {
  children?: ReactNode;
}) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const towerConfig = currentDashboard?.widgets.find(
    (w) => w.id === 'broadcast'
  )?.config;
  const transition = broadcastTransition(towerConfig);
  const setTransition = (pageTransition: BroadcastTransition) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map((w) =>
        w.id === 'broadcast'
          ? { ...w, config: { ...w.config, pageTransition } }
          : w
      ),
    });
  };

  return (
    <div className="h-full space-y-5 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
      <BroadcastHeading title="Settings" />
      <div className="relative pl-4">
        {broadcastTransitionChanged(towerConfig) && (
          <button
            type="button"
            title="Changed: click to reset"
            aria-label="Reset transition"
            className="absolute -left-2 -top-0.5 flex h-6 w-6 items-center justify-center rounded group"
            onClick={() => setTransition('random')}
          >
            <span className="h-2 w-2 rounded-full bg-accent-400 group-hover:bg-accent-300" />
          </button>
        )}
        <SettingSelectRow<BroadcastTransition>
          title="Transition"
          description="How every module animates: tower page changes, ticker views, and events, weather and podium cards popping up. Random never uses the same one twice in a row."
          value={transition}
          options={TRANSITION_OPTIONS}
          onChange={setTransition}
        />
      </div>
      {children}
    </div>
  );
};
