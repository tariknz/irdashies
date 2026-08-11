interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className={title ? 'space-y-4 px-4 pt-4 first:pt-0' : 'space-y-4'}>
      {title && <h3 className="text-lg font-medium text-slate-200">{title}</h3>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
