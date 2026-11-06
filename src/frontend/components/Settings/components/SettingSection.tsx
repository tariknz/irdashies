import { WidgetScaleSettings } from './WidgetScaleSettings';

interface SettingsSectionProps {
  title?: string;
  headingLevel?: 'h3' | 'h4';
  children?: React.ReactNode;
  /** Content scale belongs to this panel, ahead of its specialised controls. */
  scaleWidgetId?: string;
  /** Nested controls share their parent's boundary rather than another panel. */
  variant?: 'panel' | 'inline';
}

export function SettingsSection({
  title,
  headingLevel: Heading = 'h3',
  children,
  scaleWidgetId,
  variant = title ? 'panel' : 'inline',
}: SettingsSectionProps) {
  return (
    <section
      className={
        variant === 'panel'
          ? `${scaleWidgetId ? 'space-y-2' : 'space-y-4'} rounded-lg border border-slate-700 bg-slate-800/40 p-4`
          : 'space-y-3 border-l border-slate-700 pl-4'
      }
    >
      {title && (
        <Heading className="text-lg font-semibold text-slate-200">
          {title}
        </Heading>
      )}
      <div
        className={
          variant === 'panel' && !scaleWidgetId ? 'space-y-5' : 'space-y-4'
        }
      >
        {scaleWidgetId && (
          <WidgetScaleSettings
            widgetId={scaleWidgetId}
            separated={!!children}
          />
        )}
        {children}
      </div>
    </section>
  );
}
