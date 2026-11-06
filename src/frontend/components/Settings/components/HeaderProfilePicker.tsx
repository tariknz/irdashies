import { useEffect, useRef, useState } from 'react';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';

export const HeaderProfilePicker = ({
  onManage,
}: {
  onManage?: () => void;
}) => {
  const { currentProfile, profiles, switchProfile } = useDashboard();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const choose = async (id: string) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      if (id !== currentProfile?.id) await switchProfile(id);
      setOpen(false);
      trigger.current?.focus();
    } catch {
      setError('Unable to switch profile. Try again.');
      setOpen(true);
      trigger.current?.focus();
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      ref={container}
      className="relative [-webkit-app-region:no-drag]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Choose profile, current: ${currentProfile?.name ?? 'Loading'}`}
        aria-expanded={open}
        aria-controls="settings-header-profiles"
        onClick={() => setOpen((value) => !value)}
        className="-ml-2 flex min-h-7 max-w-full items-center gap-1.5 rounded-md px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        <span className="truncate">
          {currentProfile?.name ?? 'Loading'} Profile
        </span>
        <CaretDownIcon size={12} className="shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="settings-header-profiles"
          className="absolute left-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-6rem)] rounded-md border border-settings-boundary bg-slate-950 p-2 shadow-xl"
        >
          <p className="px-2 pb-1 text-xs text-slate-400">Switch profile</p>
          <div className="max-h-60 overflow-y-auto">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                aria-disabled={pending}
                aria-pressed={profile.id === currentProfile?.id}
                onClick={() => void choose(profile.id)}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800 aria-disabled:opacity-50 aria-pressed:bg-accent-400/10 aria-pressed:text-accent-200"
              >
                <span className="min-w-0 break-words">{profile.name}</span>
                {profile.id === currentProfile?.id && (
                  <CheckIcon
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
          <Link
            to="/settings/profiles"
            aria-disabled={pending}
            onClick={(event) => {
              if (pending) {
                event.preventDefault();
                return;
              }
              setOpen(false);
              onManage?.();
            }}
            className="mt-2 flex min-h-9 items-center border-t border-slate-700 px-2 pt-2 text-sm text-slate-200 hover:text-accent-200"
          >
            Manage profiles…
          </Link>
          {error && (
            <p role="alert" className="px-2 pt-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
