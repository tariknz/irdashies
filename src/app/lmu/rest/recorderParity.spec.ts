import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LMU_REST_TASKS } from './tasks';

/**
 * The recorder's path list against the app's.
 *
 * `kRestPaths` in the replay recorder decides what a tape captures, and
 * LMU_REST_TASKS decides what the app reads. They are two lists in two
 * languages that have to agree, and until this spec existed the agreement was
 * a comment: the nationalities task was added to the app and not to the
 * recorder, so every replay silently lacked driver flags.
 *
 * The failure mode is what makes this worth a spec rather than a review note.
 * An unrecorded path does not error -- tapeTransport answers `pending`, by
 * design, so that a path with no body *yet* does not latch its task off. A
 * path that was never recorded is indistinguishable from one that has not
 * arrived, so it stays pending for the whole replay and reports nothing.
 *
 * Parsed out of the C++ rather than shared through a generated file: a list of
 * five string literals is not worth a build step, and this reads the real
 * array the recorder compiles, which a duplicated copy would not.
 */
const RECORDER_SOURCE = path.resolve(
  process.cwd(),
  'src/app/lmu/native/replay/lmu_replay_main.cpp'
);

const recorderPaths = (): string[] => {
  const source = fs.readFileSync(RECORDER_SOURCE, 'utf8');
  const array = /const char\* kRestPaths\[\] = \{([\s\S]*?)\};/.exec(source);
  // Not a soft failure: if the array cannot be found the spec is no longer
  // reading what it claims to, and passing would be worse than failing.
  if (!array) throw new Error(`kRestPaths not found in ${RECORDER_SOURCE}`);
  return [...array[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
};

describe('LMU replay recorder REST paths', () => {
  it('records every path the app reads', () => {
    const recorded = new Set(recorderPaths());
    const missing = LMU_REST_TASKS.map((task) => task.path).filter(
      (taskPath) => !recorded.has(taskPath)
    );

    // Named rather than counted, so the failure says which task would lose its
    // data on replay instead of only that the lists differ.
    expect(missing).toEqual([]);
  });

  it('records nothing the app does not read', () => {
    // The looser half of the invariant: an extra path only wastes a little
    // tape, but it is almost always the trace of a task that was renamed or
    // removed on the app side and left behind here.
    const read = new Set<string>(LMU_REST_TASKS.map((task) => task.path));
    const extra = recorderPaths().filter((recorded) => !read.has(recorded));

    expect(extra).toEqual([]);
  });

  it('finds the recorder source and a non-empty list', () => {
    // Guards the parse itself: a spec that silently read an empty array would
    // pass both assertions above for the rest of time.
    expect(recorderPaths().length).toBeGreaterThanOrEqual(
      LMU_REST_TASKS.length
    );
  });
});
