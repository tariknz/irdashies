interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  children,
}: SettingsSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-medium text-slate-200">
        {title}
      </h3>

      <div className="space-y-4 pl-4">
        {children}
      </div>
    </section>
  );
}