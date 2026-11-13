import type { RacePlanFetchStatus } from '@irdashies/types';

/** Fixed so the API key can only ever be sent to iRacePlan. */
export const IRACEPLAN_BASE_URL = 'https://iraceplan.com';

const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;

export type IracePlanError = Exclude<RacePlanFetchStatus, 'ok' | 'idle'>;

export type IracePlanResponse =
  { ok: true; body: unknown } | { ok: false; error: IracePlanError };

export interface IracePlanClient {
  listPlannings(apiKey: string): Promise<IracePlanResponse>;
  getPlanning(apiKey: string, planningId: number): Promise<IracePlanResponse>;
}

async function readBoundedText(response: Response): Promise<string> {
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_RESPONSE_BYTES) throw new Error('Response too large');
  // Content-Length is optional and can be compressed, so bound the stream too.
  if (!response.body) throw new Error('Missing response body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('Response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** iRacePlan reports errors as `{ "error": "..." }`, e.g. "Invalid API key". */
const errorMessage = (body: unknown): string | null =>
  body &&
  typeof body === 'object' &&
  typeof (body as { error?: unknown }).error === 'string'
    ? (body as { error: string }).error
    : null;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export function createIracePlanClient(
  fetcher: typeof fetch = fetch
): IracePlanClient {
  const get = async (
    path: string,
    apiKey: string
  ): Promise<IracePlanResponse> => {
    let response: Response;
    try {
      response = await fetcher(`${IRACEPLAN_BASE_URL}${path}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'error',
      });
    } catch {
      return { ok: false, error: 'network' };
    }
    if (response.status === 401 || response.status === 403)
      return { ok: false, error: 'unauthorized' };
    let text: string;
    try {
      text = await readBoundedText(response);
    } catch {
      return { ok: false, error: response.ok ? 'invalid-response' : 'network' };
    }
    const body = parseJson(text);
    const message = errorMessage(body);
    if (message && /api key/i.test(message))
      return { ok: false, error: 'unauthorized' };
    if (response.status === 404) return { ok: false, error: 'not-found' };
    if (!response.ok) return { ok: false, error: 'network' };
    // An unknown planning id answers 200 with an empty body.
    if (text.trim() === '') return { ok: false, error: 'not-found' };
    if (body === undefined || message)
      return { ok: false, error: 'invalid-response' };
    return { ok: true, body };
  };

  return {
    listPlannings: (apiKey) => get('/api/v1/plannings', apiKey),
    getPlanning: (apiKey, planningId) =>
      get(`/api/v1/plannings/${encodeURIComponent(planningId)}`, apiKey),
  };
}
