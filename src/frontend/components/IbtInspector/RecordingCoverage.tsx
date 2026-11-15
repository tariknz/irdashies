import type { IbtInspectorStatus } from '@irdashies/types';

export function RecordingCoverage({ status }: { status: IbtInspectorStatus }) {
  return (
    <div>
      {!!status.coverage?.length && (
        <section className="mt-4 rounded border border-slate-700 p-3">
          <h2 className="text-sm font-semibold">Recording coverage</h2>
          <p className="mt-1 text-xs text-slate-400">
            Baseline field checks for enabled widgets. Field presence does not
            prove changing values, session events or complete behavior.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {status.coverage.map((item) => (
              <li
                key={item.widget}
                className={
                  item.status === 'missing-fields'
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }
              >
                <span className="font-semibold">{item.widget}</span>:{' '}
                {item.status === 'missing-fields'
                  ? `Missing ${item.missing.join(', ')}`
                  : item.status === 'unknown'
                    ? 'Requirements not yet audited'
                    : 'Baseline fields present'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
