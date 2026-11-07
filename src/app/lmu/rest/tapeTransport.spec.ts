import { describe, expect, it, vi } from 'vitest';
import {
  createLmuTapeRestTransport,
  TAPE_REST_FAILURE_KEY,
} from './tapeTransport';

describe('createLmuTapeRestTransport', () => {
  it('serves a recorded body as a successful response', async () => {
    const transport = createLmuTapeRestTransport({
      readRest: () => '{"total":30}',
    });

    await expect(transport('/rest/strategy/pitstop-estimate')).resolves.toEqual(
      {
        ok: true,
        body: '{"total":30}',
      }
    );
  });

  it('asks the tape for the path it was given', async () => {
    const readRest = vi.fn(() => '{}');
    await createLmuTapeRestTransport({ readRest })('/rest/sessions');

    expect(readRest).toHaveBeenCalledWith('/rest/sessions');
  });

  it('reports a path with nothing recorded yet as pending, not failed', async () => {
    // REST records are interleaved with snapshots, so early in playback a path
    // legitimately has no body. A failure here would latch the task off
    // seconds into every replay.
    const transport = createLmuTapeRestTransport({ readRest: () => null });

    await expect(transport('/rest/sessions')).resolves.toEqual({
      ok: false,
      reason: 'pending',
    });
  });

  it('serves an empty recorded body rather than calling it absent', async () => {
    // A recorded empty string is a thing the sim actually served; only null
    // means "not in this tape".
    const transport = createLmuTapeRestTransport({ readRest: () => '' });

    await expect(transport('/rest/x')).resolves.toEqual({ ok: true, body: '' });
  });

  it('does not throw when the tape read fails', async () => {
    const transport = createLmuTapeRestTransport({
      readRest: () => {
        throw new Error('tape gone');
      },
    });

    await expect(transport('/rest/x')).resolves.toEqual({
      ok: false,
      reason: 'network',
    });
  });

  describe('a recorded failure', () => {
    const served = (body: string) =>
      createLmuTapeRestTransport({ readRest: () => body })(
        '/rest/sessions/GetGameState'
      );

    it('serves an error answer as the failure it was, body and all', async () => {
      // As the recorder writes it, for GetGameState's 404 and the
      // `unavailable` answer an error status carries.
      const unavailable = '{"status": "unavailable"}';
      await expect(
        served(
          JSON.stringify({
            [TAPE_REST_FAILURE_KEY]: {
              reason: 'status',
              status: 503,
              body: unavailable,
            },
          })
        )
      ).resolves.toEqual({
        ok: false,
        reason: 'status',
        status: 503,
        body: unavailable,
      });
    });

    it('serves the sim going away as a refusal', async () => {
      await expect(
        served(`{"${TAPE_REST_FAILURE_KEY}":{"reason":"refused","body":""}}`)
      ).resolves.toEqual({ ok: false, reason: 'refused' });
    });

    it('serves anything else that starts like one as the body it is', async () => {
      for (const body of [
        `{"${TAPE_REST_FAILURE_KEY}":{"reason":"later"}}`,
        `{"${TAPE_REST_FAILURE_KEY}":`,
      ]) {
        await expect(served(body)).resolves.toEqual({ ok: true, body });
      }
    });
  });
});
