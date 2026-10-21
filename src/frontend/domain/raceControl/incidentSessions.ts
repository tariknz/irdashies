import type { Incident } from '@irdashies/types';

/** The fields of a session-info entry the incident feed needs. */
export interface IncidentSessionInfo {
  SessionNum: number;
  SessionName: string;
  SessionType: string;
}

export type IncidentFeedRow =
  | {
      kind: 'session';
      sessionNum: number;
      label: string;
      count: number;
      isCurrent: boolean;
    }
  | { kind: 'incident'; incident: Incident; isOdd: boolean };

export interface SessionFilterOption {
  sessionNum: number;
  label: string;
  count: number;
}

export interface DriverFilterOption {
  carIdx: number;
  driverName: string;
}

const titleCase = (value: string) =>
  value.toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());

/**
 * A display label per session number. Sessions that share a name get their
 * position among the namesakes as a suffix, e.g. "Practice 2".
 */
const sessionLabels = (
  sessions: readonly IncidentSessionInfo[]
): Map<number, string> => {
  const names = [...sessions]
    .sort((a, b) => a.SessionNum - b.SessionNum)
    .map((s) => ({
      sessionNum: s.SessionNum,
      name: titleCase(s.SessionName?.trim() || s.SessionType?.trim() || ''),
    }));

  const totals = new Map<string, number>();
  for (const { name } of names) totals.set(name, (totals.get(name) ?? 0) + 1);

  const seen = new Map<string, number>();
  const labels = new Map<number, string>();
  for (const { sessionNum, name } of names) {
    if (!name) continue;
    const nth = (seen.get(name) ?? 0) + 1;
    seen.set(name, nth);
    labels.set(
      sessionNum,
      (totals.get(name) ?? 0) > 1 ? `${name} ${nth}` : name
    );
  }
  return labels;
};

const labelFor = (labels: Map<number, string>, sessionNum: number) =>
  labels.get(sessionNum) ?? `Session ${sessionNum + 1}`;

/**
 * Groups already-filtered incidents by session, newest session first, with a
 * separator row before each group. The current session always gets a
 * separator, even when empty, so a session change is visible straight away.
 */
export const buildIncidentFeedRows = (
  incidents: readonly Incident[],
  sessions: readonly IncidentSessionInfo[],
  currentSessionNum: number | null
): IncidentFeedRow[] => {
  const groups = new Map<number, Incident[]>();
  for (const incident of incidents) {
    const group = groups.get(incident.sessionNum);
    if (group) group.push(incident);
    else groups.set(incident.sessionNum, [incident]);
  }
  if (currentSessionNum !== null && !groups.has(currentSessionNum)) {
    groups.set(currentSessionNum, []);
  }

  const labels = sessionLabels(sessions);
  const rows: IncidentFeedRow[] = [];
  const sessionNums = [...groups.keys()].sort((a, b) => b - a);
  for (const sessionNum of sessionNums) {
    const group = (groups.get(sessionNum) ?? []).sort(
      (a, b) => b.sessionTime - a.sessionTime
    );
    rows.push({
      kind: 'session',
      sessionNum,
      label: labelFor(labels, sessionNum),
      count: group.length,
      isCurrent: sessionNum === currentSessionNum,
    });
    group.forEach((incident, idx) =>
      rows.push({ kind: 'incident', incident, isOdd: idx % 2 !== 0 })
    );
  }
  return rows;
};

/**
 * One option per session with at least one incident, newest session first.
 * A selected session stays listed after its incidents are cleared, so the
 * dropdown never shows a value it has no option for.
 */
export const buildSessionFilterOptions = (
  allIncidents: readonly Incident[],
  sessions: readonly IncidentSessionInfo[],
  selectedSessionNum: number | null = null
): SessionFilterOption[] => {
  const counts = new Map<number, number>();
  if (selectedSessionNum !== null) counts.set(selectedSessionNum, 0);
  for (const incident of allIncidents) {
    counts.set(incident.sessionNum, (counts.get(incident.sessionNum) ?? 0) + 1);
  }
  const labels = sessionLabels(sessions);
  return [...counts.entries()]
    .sort(([a], [b]) => b - a)
    .map(([sessionNum, count]) => ({
      sessionNum,
      label: labelFor(labels, sessionNum),
      count,
    }));
};

/**
 * Drivers with incidents in the selected session (or any session when null),
 * sorted by name. The selected driver stays listed so the dropdown never shows
 * a value it has no option for.
 */
export const buildDriverFilterOptions = (
  allIncidents: readonly Incident[],
  sessionNum: number | null,
  selectedCarIdx: number | null
): DriverFilterOption[] => {
  const drivers = new Map<number, string>();
  for (const incident of allIncidents) {
    if (drivers.has(incident.carIdx)) continue;
    if (
      sessionNum === null ||
      incident.sessionNum === sessionNum ||
      incident.carIdx === selectedCarIdx
    ) {
      drivers.set(incident.carIdx, incident.driverName);
    }
  }
  return [...drivers.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([carIdx, driverName]) => ({ carIdx, driverName }));
};
