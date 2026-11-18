import { TrashIcon } from '@phosphor-icons/react';
import { useCarSetup } from '@irdashies/context';
import type { CarSetupInfo } from '@irdashies/types';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ReorderControls } from '../components/ReorderControls';
import { SettingsSection } from '../components/SettingSection';
import { TabButton } from '../components/TabButton';

type SetupData = CarSetupInfo &
  Partial<Record<'Tires' | 'Dampers' | 'Drivetrain' | 'Systems', object>>;
type SetupValue = string | number | undefined;
type ComparisonMode = 'first' | 'previous';

interface Snapshot {
  id: number;
  timestamp: number;
  data: SetupData;
}

const setupSections = [
  ['Tires', 'Tires'],
  ['TiresAero', 'Tires & Aero'],
  ['Chassis', 'Chassis'],
  ['Suspension', 'Suspension'],
  ['Dampers', 'Dampers'],
  ['Drivetrain', 'Drivetrain'],
  ['DriveBrake', 'Drive & Brake'],
  ['Systems', 'Systems'],
] as const;

const formatSetupLabel = (label: string) =>
  label
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');

const isSetupGroup = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getSetupValue = (data: SetupData, path: string[]): SetupValue => {
  const value = path.reduce<unknown>(
    (group, key) => (isSetupGroup(group) ? group[key] : undefined),
    data
  );
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return value;
};

const isChanged = (value: SetupValue, reference: SetupValue) =>
  value !== undefined &&
  value !== '' &&
  reference !== undefined &&
  reference !== '' &&
  String(value) !== String(reference);

interface SetupRowProps {
  label: string;
  values: SetupValue[];
  mode: ComparisonMode;
}

const SetupRow = ({ label, values, mode }: SetupRowProps) => (
  <tr>
    <th
      scope="row"
      className="sticky left-0 border-r border-b border-slate-700/60 bg-slate-900 px-3 py-1.5 text-left align-top font-normal wrap-anywhere text-slate-300"
    >
      {formatSetupLabel(label)}
    </th>
    {values.map((value, index) => {
      const reference = values[mode === 'first' ? 0 : index - 1];
      const changed = index > 0 && isChanged(value, reference);
      return (
        <td
          key={index}
          className={`border-r border-b border-slate-700/60 px-1.5 py-1.5 text-right align-top font-mono wrap-anywhere tabular-nums last:border-r-transparent ${
            changed
              ? 'bg-amber-500/10 font-semibold text-amber-400'
              : 'text-slate-200'
          }`}
        >
          {changed && <span className="sr-only">Changed </span>}
          {value === undefined || value === '' ? '—' : value}
        </td>
      );
    })}
  </tr>
);

interface SetupSectionProps {
  title: string;
  sectionKey: string;
  data: object;
  snapshots: Snapshot[];
  mode: ComparisonMode;
}

const SetupTableSection = ({
  title,
  sectionKey,
  data,
  snapshots,
  mode,
}: SetupSectionProps) => {
  const renderRow = (label: string, path: string[]) => (
    <SetupRow
      key={label}
      label={label}
      values={snapshots.map(({ data }) => getSetupValue(data, path))}
      mode={mode}
    />
  );

  const fields: [string, unknown][] = Object.entries(data);
  return (
    <tbody>
      <tr>
        <th
          scope="rowgroup"
          className="sticky left-0 border-b border-slate-700 bg-slate-800 px-3 py-2 text-left text-slate-200"
        >
          <h3 className="text-lg font-semibold">{title}</h3>
        </th>
        <td
          colSpan={snapshots.length}
          className="border-b border-slate-700 bg-slate-800"
        />
      </tr>
      {fields.map(([key, value]) => {
        if (!isSetupGroup(value)) return renderRow(key, [sectionKey, key]);

        const groupFields = Object.keys(value);
        if (groupFields.length === 1 && groupFields[0] === key) {
          return renderRow(key, [sectionKey, key, key]);
        }
        return (
          <SetupGroup key={key} label={key} columnCount={snapshots.length}>
            {groupFields.map((field) =>
              renderRow(field, [sectionKey, key, field])
            )}
          </SetupGroup>
        );
      })}
    </tbody>
  );
};

const SetupGroup = ({
  label,
  columnCount,
  children,
}: {
  label: string;
  columnCount: number;
  children: React.ReactNode;
}) => (
  <>
    <tr>
      <td className="sticky left-0 border-b border-slate-700/60 bg-settings-control px-3 py-1.5">
        <h4 className="text-sm font-semibold wrap-anywhere text-slate-300">
          {formatSetupLabel(label)}
        </h4>
      </td>
      <td
        colSpan={columnCount}
        className="border-b border-slate-700/60 bg-settings-control"
      />
    </tr>
    {children}
  </>
);

export const CarSetupSettings = () => {
  const setup: SetupData | undefined = useCarSetup();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [mode, setMode] = useState<ComparisonMode>('first');
  const nextSnapshotId = useRef(1);
  const captureButton = useRef<HTMLButtonElement>(null);
  const removeButtons = useRef(new Map<number, HTMLButtonElement>());
  const focusCapture = useRef(false);

  useLayoutEffect(() => {
    if (snapshots.length === 0 && focusCapture.current) {
      focusCapture.current = false;
      captureButton.current?.focus();
    }
  }, [snapshots.length]);

  const hasData = setup && setupSections.some(([key]) => setup[key]);
  const canTakeSnapshot =
    hasData &&
    (snapshots.length === 0 ||
      setup.UpdateCount !== snapshots.at(-1)?.data.UpdateCount);

  const captureSnapshot = () => {
    if (!setup) return;
    const snapshot: Snapshot = {
      id: nextSnapshotId.current++,
      timestamp: Date.now(),
      data: structuredClone(setup),
    };
    setSnapshots((previous) => [...previous, snapshot]);
  };

  const clearSnapshots = () => {
    focusCapture.current = true;
    setSnapshots([]);
    setMode('first');
  };

  const removeSnapshot = (index: number) => {
    if (snapshots.length === 1) {
      clearSnapshots();
      return;
    }
    const neighbor = snapshots[index + 1] ?? snapshots[index - 1];
    removeButtons.current.get(neighbor.id)?.focus();
    const { id } = snapshots[index];
    setSnapshots((previous) =>
      previous.filter((snapshot) => snapshot.id !== id)
    );
  };

  const moveSnapshot = (id: number, offset: -1 | 1) => {
    setSnapshots((previous) => {
      const index = previous.findIndex((snapshot) => snapshot.id === id);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= previous.length) return previous;

      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-700 pt-1 pb-3">
        <div>
          <h2 className="mb-1 text-xl font-semibold tracking-tight text-slate-100">
            Setup Comparison
          </h2>
          <p className="text-sm text-slate-400">
            Capture and compare car setups from iRacing.
          </p>
        </div>
        {hasData && (
          <div className="flex flex-wrap gap-2">
            <button
              ref={captureButton}
              type="button"
              onClick={captureSnapshot}
              disabled={!canTakeSnapshot}
              className="settings-button-primary"
            >
              Take Snapshot
            </button>
            {snapshots.length > 0 && (
              <button
                type="button"
                onClick={clearSnapshots}
                className="settings-button-danger"
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </header>
      {!setup || !hasData || snapshots.length === 0 ? (
        <SettingsSection variant="panel">
          <p className="text-sm text-slate-300">
            {hasData
              ? 'Take a snapshot to start comparing setups.'
              : 'Join an iRacing session and get in the car to load setup data.'}
          </p>
        </SettingsSection>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            <div
              role="group"
              aria-label="Comparison mode"
              className="flex flex-wrap items-center gap-x-2"
            >
              <span className="text-sm text-slate-300">Compare</span>
              <TabButton id="first" activeTab={mode} setActiveTab={setMode}>
                To First
              </TabButton>
              <TabButton id="previous" activeTab={mode} setActiveTab={setMode}>
                To Previous
              </TabButton>
            </div>
            <p className="text-sm text-slate-400">
              Changed values are highlighted.
            </p>
          </div>
          <div
            role="region"
            aria-label="Setup snapshots"
            tabIndex={0}
            className="min-h-40 overflow-auto rounded-lg border border-slate-700 focus-visible:-outline-offset-4"
          >
            <table
              className="w-full min-w-[calc(var(--setup-label-width)+var(--snapshot-count)*8rem)] table-fixed border-separate border-spacing-0 text-sm [--setup-label-width:9rem] lg:[--setup-label-width:14rem]"
              style={{ '--snapshot-count': snapshots.length } as CSSProperties}
            >
              <caption className="sr-only">Car setup comparison</caption>
              <colgroup>
                <col className="w-(--setup-label-width)" />
                <col span={snapshots.length} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-800">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 border-r border-b border-slate-700 bg-slate-800 px-3 py-2 text-left font-semibold text-slate-200"
                  >
                    Setting
                  </th>
                  {snapshots.map((snapshot, index) => {
                    const label = `Snapshot ${snapshot.id}`;
                    const capturedAt = new Date(snapshot.timestamp);
                    return (
                      <th
                        key={snapshot.id}
                        scope="col"
                        aria-label={label}
                        className="border-r border-b border-slate-700 px-1.5 pt-2 pb-1 text-right font-normal last:border-r-transparent"
                      >
                        <div className="font-semibold text-slate-200">
                          {label}
                        </div>
                        <time
                          dateTime={capturedAt.toISOString()}
                          className="text-xs text-slate-400 tabular-nums"
                        >
                          {capturedAt.toLocaleTimeString()}
                        </time>
                        <div className="flex justify-end">
                          <ReorderControls
                            label={label}
                            position={index + 1}
                            total={snapshots.length}
                            orientation="horizontal"
                            onMoveUp={
                              index > 0
                                ? () => moveSnapshot(snapshot.id, -1)
                                : undefined
                            }
                            onMoveDown={
                              index < snapshots.length - 1
                                ? () => moveSnapshot(snapshot.id, 1)
                                : undefined
                            }
                          />
                          <button
                            ref={(button) => {
                              if (button)
                                removeButtons.current.set(snapshot.id, button);
                              else removeButtons.current.delete(snapshot.id);
                            }}
                            type="button"
                            aria-label={`Remove ${label}`}
                            title={`Remove ${label}`}
                            onClick={() => removeSnapshot(index)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-red-300 hover:bg-red-950/60"
                          >
                            <TrashIcon size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {setupSections.map(([key, title]) => {
                const data = setup[key];
                if (!data || (key === 'Suspension' && data === setup.Chassis)) {
                  return null;
                }
                return (
                  <SetupTableSection
                    key={key}
                    title={title}
                    sectionKey={key}
                    data={
                      key === 'Suspension'
                        ? Object.fromEntries(
                            Object.entries({
                              Front: setup.Suspension?.Front,
                              Rear: setup.Suspension?.Rear,
                            }).filter(([, value]) => value)
                          )
                        : data
                    }
                    snapshots={snapshots}
                    mode={mode}
                  />
                );
              })}
            </table>
          </div>
        </>
      )}
    </div>
  );
};
