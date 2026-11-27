import { ipcMain } from 'electron';
import type { ReplayDirectorRuntime } from '../processors/replayDirectorRuntime';

export const setupReplayDirectorBridge = (
  runtime: ReplayDirectorRuntime
): void => {
  ipcMain.handle('replayDirector:backToProgram', () => runtime.backToProgram());
  ipcMain.handle('replayDirector:resumeAtCut', () => runtime.resumeAtCut());
  ipcMain.handle('replayDirector:stayHere', () => runtime.stayHere());
};
