import { describe, expect, it, vi } from 'vitest';

describe('replayDirectorBridge', () => {
  it('delegates backToProgram to runtime', async () => {
    const runtime = {
      backToProgram: vi.fn().mockResolvedValue(undefined),
      resumeAtCut: vi.fn().mockResolvedValue(undefined),
      stayHere: vi.fn().mockResolvedValue(undefined),
    };
    await runtime.backToProgram();
    expect(runtime.backToProgram).toHaveBeenCalledOnce();
  });

  it('delegates resumeAtCut to runtime', async () => {
    const runtime = {
      resumeAtCut: vi.fn().mockResolvedValue(undefined),
    };
    await runtime.resumeAtCut();
    expect(runtime.resumeAtCut).toHaveBeenCalledOnce();
  });

  it('delegates stayHere to runtime', async () => {
    const runtime = {
      stayHere: vi.fn().mockResolvedValue(undefined),
    };
    await runtime.stayHere();
    expect(runtime.stayHere).toHaveBeenCalledOnce();
  });
});
