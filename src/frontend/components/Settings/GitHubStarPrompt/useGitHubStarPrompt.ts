import { useCallback, useEffect, useRef, useState } from 'react';

const VISITS_KEY = 'irdashies:github-star-prompt:visits';
const DISMISSED_KEY = 'irdashies:github-star-prompt:dismissed';
const FIRST_SEEN_KEY = 'irdashies:github-star-prompt:first-seen';
const VISITS_BEFORE_ASKING = 5;
const MINIMUM_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const IDLE_MS = 30_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'focus'] as const;

function readFirstSeen(): number | undefined {
  const saved = localStorage.getItem(FIRST_SEEN_KEY);
  if (saved === null || saved.trim() === '') return;
  const timestamp = Number(saved);
  if (
    Number.isSafeInteger(timestamp) &&
    timestamp >= 0 &&
    timestamp <= Date.now()
  )
    return timestamp;
}

export function useGitHubStarPrompt(paused: boolean) {
  const [visits, setVisits] = useState(0);
  const [visible, setVisible] = useState(false);
  const wasVisible = useRef(false);
  const dismissed = useRef(false);

  useEffect(() => {
    const recordVisit = () => {
      const isVisible = document.visibilityState === 'visible';
      if (isVisible && !wasVisible.current) {
        try {
          if (localStorage.getItem(DISMISSED_KEY) !== 'true') {
            // Start the grace period on first use, including existing installs
            // without a timestamp. Invalid preferences start a fresh wait.
            if (readFirstSeen() === undefined)
              localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
            const saved = Number(localStorage.getItem(VISITS_KEY));
            const previous =
              Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
            const next = Math.min(previous + 1, VISITS_BEFORE_ASKING);
            // Do not ask if storage cannot retain a permanent dismissal.
            localStorage.setItem(VISITS_KEY, String(next));
            setVisits(next);
          }
        } catch {
          setVisits(0);
        }
      }
      wasVisible.current = isVisible;
    };
    recordVisit();
    document.addEventListener('visibilitychange', recordVisit);
    return () => document.removeEventListener('visibilitychange', recordVisit);
  }, []);

  useEffect(() => {
    if (paused) setVisible(false);
    if (paused || visible || visits < VISITS_BEFORE_ASKING || dismissed.current)
      return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => clearTimeout(timer);
    const restart = () => {
      cancel();
      if (document.hidden || !document.hasFocus()) return;
      let delay: number;
      try {
        const firstSeen = readFirstSeen();
        if (firstSeen === undefined) return;
        delay = Math.max(IDLE_MS, firstSeen + MINIMUM_AGE_MS - Date.now());
      } catch {
        return;
      }
      timer = setTimeout(() => {
        if (
          document.hidden ||
          !document.hasFocus() ||
          document.activeElement?.matches('iframe, webview') ||
          document.querySelector('dialog[open], [role="dialog"]') ||
          dismissed.current
        )
          return;
        try {
          const firstSeen = readFirstSeen();
          if (
            firstSeen !== undefined &&
            Date.now() - firstSeen >= MINIMUM_AGE_MS &&
            localStorage.getItem(DISMISSED_KEY) !== 'true'
          )
            setVisible(true);
        } catch {
          // Unavailable preferences must not turn into a repeated request.
        }
      }, delay);
    };
    for (const type of ACTIVITY_EVENTS)
      window.addEventListener(type, restart, { capture: true, passive: true });
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', restart);
    restart();
    return () => {
      cancel();
      for (const type of ACTIVITY_EVENTS)
        window.removeEventListener(type, restart, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', restart);
    };
  }, [paused, visible, visits]);

  useEffect(() => {
    const syncDismissal = (event: StorageEvent) => {
      if (event.key === DISMISSED_KEY && event.newValue === 'true') {
        dismissed.current = true;
        setVisible(false);
      }
    };
    window.addEventListener('storage', syncDismissal);
    return () => window.removeEventListener('storage', syncDismissal);
  }, []);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Still dismiss for this window if storage becomes unavailable.
    }
  }, []);

  return { visible: visible && !paused, dismiss };
}
