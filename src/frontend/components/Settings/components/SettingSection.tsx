interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
  /** Nested controls share their parent's boundary rather than another panel. */
  variant?: 'panel' | 'inline';
}

export function SettingsSection({
  title,
  children,
  variant = title ? 'panel' : 'inline',
}: SettingsSectionProps) {
  return (
    <section
      className={
        variant === 'panel'
          ? 'space-y-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4'
          : 'space-y-3 border-l border-slate-700 pl-4'
      }
    >
      {title && (
        <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      )}
      <div className={variant === 'panel' ? 'space-y-5' : 'space-y-4'}>
        {children}
      </div>
    </section>
  );
}
