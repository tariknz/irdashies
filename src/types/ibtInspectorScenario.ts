export interface IbtInspectorScenario {
  file: string;
  profileId: string;
  speed: number | 'max';
  position: number;
  loop: { start: number; end: number } | null;
}

export function isIbtInspectorScenario(
  value: unknown
): value is IbtInspectorScenario {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.file !== 'string' ||
    !v.file.toLowerCase().endsWith('.ibt') ||
    /[/\\:\0]/.test(v.file) ||
    v.file.length > 255
  )
    return false;
  if (
    typeof v.profileId !== 'string' ||
    !v.profileId ||
    v.profileId.length > 256
  )
    return false;
  if (
    v.speed !== 'max' &&
    (typeof v.speed !== 'number' ||
      !Number.isFinite(v.speed) ||
      v.speed < 0.25 ||
      v.speed > 100)
  )
    return false;
  if (
    typeof v.position !== 'number' ||
    !Number.isFinite(v.position) ||
    v.position < 0
  )
    return false;
  if (v.loop === null) return true;
  if (!v.loop || typeof v.loop !== 'object') return false;
  const range = v.loop as Record<string, unknown>;
  return (
    typeof range.start === 'number' &&
    Number.isFinite(range.start) &&
    range.start >= 0 &&
    typeof range.end === 'number' &&
    Number.isFinite(range.end) &&
    range.end > range.start
  );
}
