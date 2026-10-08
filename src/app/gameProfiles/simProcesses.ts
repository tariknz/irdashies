import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isActiveSimulator, type ActiveSimulator } from '@irdashies/types';
import type { SimProcessSnapshot } from './resolveGameProfile';

const execFileAsync = promisify(execFile);

/**
 * Sim executables only. iRacingUI.exe is the launcher, not the sim, so it
 * does not count as iRacing running.
 */
const SIM_PROCESS_NAMES: Record<string, ActiveSimulator> = {
  'iracingsim64dx11.exe': 'iracing',
  iracingsim64dx11: 'iracing',
  'le mans ultimate.exe': 'lmu',
};

const LIST_COMMAND =
  "Get-CimInstance -ClassName Win32_Process -Filter \"Name = 'iRacingSim64DX11.exe' OR Name = 'iRacingSim64DX11' OR Name = 'Le Mans Ultimate.exe'\" | ForEach-Object { if ($_.CreationDate) { $_.Name + '|' + [DateTimeOffset]::new($_.CreationDate).ToUnixTimeMilliseconds() } }";

export function parseSimProcessLines(text: string): SimProcessSnapshot[] {
  const processes: SimProcessSnapshot[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separator = trimmed.lastIndexOf('|');
    if (separator <= 0) continue;
    const id = SIM_PROCESS_NAMES[trimmed.slice(0, separator).trim().toLowerCase()];
    const startedAt = Number(trimmed.slice(separator + 1));
    if (!id || !Number.isFinite(startedAt)) continue;
    processes.push({ id, startedAt });
  }
  return processes;
}

/**
 * `IRDASHIES_FAKE_SIM_PROCESSES=iracing:1000,lmu:2000` stands in for a live
 * process list. An empty value means nothing is running.
 */
function parseFakeProcesses(value: string): SimProcessSnapshot[] {
  if (!value.trim()) return [];
  const processes: SimProcessSnapshot[] = [];
  for (const part of value.split(',')) {
    const [id, started] = part.trim().split(':');
    const startedAt = Number(started);
    if (!isActiveSimulator(id) || !Number.isFinite(startedAt)) continue;
    processes.push({ id, startedAt });
  }
  return processes;
}

export async function listSimProcesses(): Promise<SimProcessSnapshot[]> {
  const fake = process.env.IRDASHIES_FAKE_SIM_PROCESSES;
  if (fake !== undefined) return parseFakeProcesses(fake);
  if (process.platform !== 'win32') return [];

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', LIST_COMMAND],
    { windowsHide: true, timeout: 5000 }
  );
  return parseSimProcessLines(String(stdout));
}
