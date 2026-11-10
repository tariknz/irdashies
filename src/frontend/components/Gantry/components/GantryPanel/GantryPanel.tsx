import { t } from '@irdashies/frontend/i18n';
import { memo, type ReactNode } from 'react';

interface GantryPanelProps {
  title?: string;
  /** Names the panel when it draws its own heading. */
  label?: string;
  /** Sits opposite the title, such as a count. */
  aside?: ReactNode;
  /** Leaves the body outside the settings theme, for hosted overlay widgets. */
  overlayContent?: boolean;
  children: ReactNode;
}

export const GantryPanel = memo(
  ({
    title,
    label,
    aside,
    overlayContent = false,
    children,
  }: GantryPanelProps) => (
    <section
      aria-label={t(label) ?? t(title)}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-settings-hover bg-settings-control/40"
    >
      {title && (
        <div className="settings-shell flex shrink-0 items-baseline justify-between gap-4 px-4 py-2">
          <h2 className="text-lg leading-snug font-semibold text-slate-200">
            {t(title)}
          </h2>
          {aside}
        </div>
      )}
      <div
        className={[
          'flex min-h-0 flex-1 flex-col',
          overlayContent ? '' : 'settings-shell',
        ].join(' ')}
      >
        {children}
      </div>
    </section>
  )
);
GantryPanel.displayName = 'GantryPanel';
