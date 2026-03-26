import { useCarSetup } from '@irdashies/context';
import type { CarSetupInfo } from '@irdashies/types';
import { memo, type ReactNode, useState } from 'react';

interface Snapshot {
  id: string;
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

type ComparisonMode = 'previous' | 'all';

interface SetupRowProps {
  label: string;
  values: (string | number | undefined)[];
  unit?: string;
  comparisonMode?: ComparisonMode;
}

const isHighlighted = (
  values: (string | number | undefined)[],
  index: number,
  mode: ComparisonMode
): boolean => {
  if (values.length <= 1 || index === 0) return false;

  const cur = values[index];
  if (cur === undefined || cur === null || cur === '') return false;

  if (mode === 'previous') {
    const ref = values[0];
    return (
      ref !== undefined &&
      ref !== null &&
      ref !== '' &&
      String(cur) !== String(ref)
    );
  }
  const left = values[index - 1];
  return (
    left !== undefined &&
    left !== null &&
    left !== '' &&
    String(cur) !== String(left)
  );
};

const SetupRow = memo(
  ({
    label,
    values,
    unit = '',
    comparisonMode = 'previous',
  }: SetupRowProps) => {
    if (values.length === 0) return null;

    if (values.length === 1) {
      return (
        <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
          <span className="text-slate-400 text-xs">{label}</span>
          <span className="text-xs font-mono text-white">
            {values[0]} {unit}
          </span>
        </div>
      );
    }
    return (
      <div
        className="grid gap-2 py-1 border-b border-slate-700/30 items-center"
        style={{
          gridTemplateColumns: `1fr ${values.map(() => 'auto').join(' ')}`,
        }}
      >
        <span className="text-slate-400 text-xs">{label}</span>
        {values.map((val, idx) => (
          <span
            key={idx}
            className={`text-xs font-mono text-right min-w-20 ${
              isHighlighted(values, idx, comparisonMode)
                ? 'text-red-400 font-bold'
                : 'text-white'
            }`}
          >
            {val} {unit}
          </span>
        ))}
      </div>
    );
  }
);
SetupRow.displayName = 'SetupRow';

interface SetupSectionProps {
  title: string;
  children: ReactNode;
  snapshots?: Snapshot[];
}

const SetupSection = memo(
  ({ title, children, snapshots = [] }: SetupSectionProps) => {
    const hasSnapshots = snapshots.length > 0;

    return (
      <div className="mb-4 last:mb-0">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">{title}</h4>
        {hasSnapshots && (
          <div
            className="grid gap-2 py-1 mb-1 border-b border-slate-500"
            style={{
              gridTemplateColumns: `1fr ${snapshots.map(() => 'auto').join(' ')}`,
            }}
          >
            <span className="text-slate-500 text-xs font-semibold" />
            {snapshots.map((snapshot) => (
              <span
                key={snapshot.id}
                className="text-slate-500 text-xs font-semibold text-right min-w-20"
              >
                {new Date(snapshot.timestamp).toLocaleTimeString()}
              </span>
            ))}
          </div>
        )}
        <div className="space-y-0.5">{children}</div>
      </div>
    );
  }
);
SetupSection.displayName = 'SetupSection';

const buildValues = (
  snapshots: Snapshot[],
  path: string[]
): (string | number | undefined)[] => {
  return snapshots.map((snapshot) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = snapshot.data;
    for (const key of path) {
      value = value?.[key];
      if (value === undefined) return undefined;
    }
    return value;
  });
};

const SectionAccordion = memo(
  ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="border border-slate-700 rounded">
      <div className="p-3">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
);
SectionAccordion.displayName = 'SectionAccordion';

interface SectionProps {
  setup: CarSetupInfo;
  snapshots?: Snapshot[];
  comparisonMode?: ComparisonMode;
}

const renderObjectSection = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  sectionPath: string[],
  snapshots: Snapshot[],
  comparisonMode: ComparisonMode
) => {
  return Object.entries(data).map(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      return (
        <SetupSection key={key} title={key} snapshots={snapshots}>
          {Object.entries(value as Record<string, unknown>).map(([subKey]) => {
            const snapshotValues = snapshots.map((s) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let v: any = s.data;
              for (const p of sectionPath) v = v?.[p];
              const raw = v?.[key]?.[subKey];
              return typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : raw;
            });

            return (
              <SetupRow
                key={subKey}
                label={subKey}
                values={snapshotValues}
                comparisonMode={comparisonMode}
              />
            );
          })}
        </SetupSection>
      );
    }

    // Top-level primitive
    return (
      <SetupRow
        key={key}
        label={key}
        values={buildValues(snapshots, [...sectionPath, key])}
        comparisonMode={comparisonMode}
      />
    );
  });
};

const TiresAeroSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tiresAero = setup.TiresAero || (setup as any).Tires;
    if (!tiresAero) return null;
    const sectionKey = setup.TiresAero ? 'TiresAero' : 'Tires';
    return (
      <SectionAccordion title="Tires &amp; Aero">
        {renderObjectSection(
          tiresAero,
          [sectionKey],
          snapshots,
          comparisonMode
        )}
      </SectionAccordion>
    );
  }
);
TiresAeroSection.displayName = 'TiresAeroSection';

const ChassisSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    const chassis = setup.Chassis;
    if (!chassis) return null;
    return (
      <SectionAccordion title="Chassis">
        {renderObjectSection(
          chassis as unknown as Record<string, unknown>,
          ['Chassis'],
          snapshots,
          comparisonMode
        )}
      </SectionAccordion>
    );
  }
);
ChassisSection.displayName = 'ChassisSection';

const SuspensionSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    const suspension = setup.Suspension;
    if (!suspension || suspension === setup.Chassis) return null;
    return (
      <SectionAccordion title="Suspension">
        {suspension.Front && (
          <SetupSection title="Front" snapshots={snapshots}>
            {Object.entries(suspension.Front).map(([key]) => (
              <SetupRow
                key={key}
                label={key}
                values={buildValues(snapshots, ['Suspension', 'Front', key])}
                comparisonMode={comparisonMode}
              />
            ))}
          </SetupSection>
        )}
        {suspension.Rear && (
          <SetupSection title="Rear" snapshots={snapshots}>
            {Object.entries(suspension.Rear).map(([key]) => (
              <SetupRow
                key={key}
                label={key}
                values={buildValues(snapshots, ['Suspension', 'Rear', key])}
                comparisonMode={comparisonMode}
              />
            ))}
          </SetupSection>
        )}
      </SectionAccordion>
    );
  }
);
SuspensionSection.displayName = 'SuspensionSection';

const DriveBrakeSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    const driveBrake = setup.DriveBrake;
    if (!driveBrake) return null;
    return (
      <SectionAccordion title="Drive &amp; Brake">
        {renderObjectSection(
          driveBrake as unknown as Record<string, unknown>,
          ['DriveBrake'],
          snapshots,
          comparisonMode
        )}
      </SectionAccordion>
    );
  }
);
DriveBrakeSection.displayName = 'DriveBrakeSection';

const TiresSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tires = (setup as any).Tires;
    if (!tires) return null;
    return (
      <SectionAccordion title="Tires">
        {renderObjectSection(tires, ['Tires'], snapshots, comparisonMode)}
      </SectionAccordion>
    );
  }
);
TiresSection.displayName = 'TiresSection';

const DrivetrainSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drivetrain = (setup as any).Drivetrain;
    if (!drivetrain) return null;
    return (
      <SectionAccordion title="Drivetrain">
        {renderObjectSection(
          drivetrain,
          ['Drivetrain'],
          snapshots,
          comparisonMode
        )}
      </SectionAccordion>
    );
  }
);
DrivetrainSection.displayName = 'DrivetrainSection';

const DampersSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dampers = (setup as any).Dampers;
    if (!dampers) return null;
    return (
      <SectionAccordion title="Dampers">
        {renderObjectSection(dampers, ['Dampers'], snapshots, comparisonMode)}
      </SectionAccordion>
    );
  }
);
DampersSection.displayName = 'DampersSection';

const SystemsSection = memo(
  ({ setup, snapshots = [], comparisonMode = 'previous' }: SectionProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const systems = (setup as any).Systems;
    if (!systems) return null;
    return (
      <SectionAccordion title="Systems">
        {renderObjectSection(systems, ['Systems'], snapshots, comparisonMode)}
      </SectionAccordion>
    );
  }
);
SystemsSection.displayName = 'SystemsSection';

export const CarSetupSettings = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setup = useCarSetup() as any;

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [comparisonMode, setComparisonMode] =
    useState<ComparisonMode>('previous');

  const handleTakeSnapshot = () => {
    if (setup) {
      setSnapshots((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          timestamp: Date.now(),
          data: JSON.parse(JSON.stringify(setup)),
        },
      ]);
    }
  };

  const handleClearAll = () => {
    setSnapshots([]);
    setComparisonMode('previous');
  };

  const handleRemove = (id: string) => {
    setSnapshots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) setComparisonMode('previous');
      return next;
    });
  };

  const handleMoveLeft = (index: number) => {
    if (index <= 0) return;
    setSnapshots((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const handleMoveRight = (index: number) => {
    setSnapshots((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const hasData =
    setup &&
    (setup.Tires ||
      setup.TiresAero ||
      setup.Chassis ||
      setup.Suspension ||
      setup.DriveBrake ||
      setup.Drivetrain ||
      setup.Dampers ||
      setup.Systems);

  const canTakeSnapshot =
    hasData &&
    (snapshots.length === 0 ||
      setup.UpdateCount !== snapshots[snapshots.length - 1]?.data?.UpdateCount);

  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-2">
            Car setup data is not available.
          </p>
          <p className="text-slate-500 text-sm">
            Join a session and get in the car to view setup information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">Car Setup</h2>
            <p className="text-sm text-slate-400">
              Current car setup configuration from iRacing
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTakeSnapshot}
              disabled={!canTakeSnapshot}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
            >
              Take Snapshot
            </button>
            {snapshots.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
        {snapshots.length > 0 && (
          <>
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-sm text-slate-400">Compare:</span>
              {(
                [
                  ['previous', 'To First'],
                  ['all', 'To Previous'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setComparisonMode(mode)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    comparisonMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="bg-amber-900/30 border border-amber-600/50 rounded p-3">
              <p className="text-amber-300 text-sm font-medium">
                {comparisonMode === 'previous'
                  ? 'Comparing all columns to the first (leftmost) snapshot - differences in red'
                  : 'Comparing each column to the one directly to its left - differences in red'}
              </p>
            </div>
          </>
        )}
        {snapshots.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-slate-500 text-sm">
              Click &quot;Take Snapshot&quot; to capture the current setup.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="grid gap-2 py-2 border-b border-slate-500 sticky top-0 bg-slate-800 z-10"
              style={{
                gridTemplateColumns: `1fr ${snapshots.map(() => 'auto').join(' ')}`,
              }}
            >
              <span />
              {snapshots.map((snapshot, index) => (
                <div key={snapshot.id} className="text-right min-w-20">
                  <div className="text-slate-300 text-xs font-semibold">
                    {new Date(snapshot.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="flex justify-end gap-0.5 mt-1">
                    <button
                      onClick={() => handleMoveLeft(index)}
                      disabled={index === 0}
                      className="px-1 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => handleMoveRight(index)}
                      disabled={index === snapshots.length - 1}
                      className="px-1 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
                    >
                      →
                    </button>
                    <button
                      onClick={() => handleRemove(snapshot.id)}
                      className="px-1 py-0.5 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <TiresSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
            <TiresAeroSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
            <ChassisSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
            <SuspensionSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
            <DampersSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
            <DrivetrainSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
            <DriveBrakeSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
            <SystemsSection
              setup={setup}
              snapshots={snapshots}
              comparisonMode={comparisonMode}
            />
          </div>
        )}
      </div>
    </div>
  );
};
