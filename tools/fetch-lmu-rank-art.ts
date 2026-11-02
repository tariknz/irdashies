/**
 * Fetch the LMU rank and badge artwork, the inputs to build-lmu-sprite.cjs.
 *
 * Usage:
 *   npm run fetch-lmu-rank-art            # skips files already present
 *   npm run fetch-lmu-rank-art -- --force # re-fetches everything
 *
 * `npm run build-lmu-sprite` runs this first, so it rarely needs running on
 * its own.
 *
 * The art lives on Studio 397's public bucket, which is also where the sim's
 * own UI and LMUTraceHUB read it from. It is never requested at runtime: the
 * alternative is a standings row reaching the network per driver per session,
 * which is not a trade an overlay should make. What the app ships is the two
 * sprite sheets built from it, and only those are committed. The SVGs land in
 * a gitignored cache and are fetched again whenever the sprites are rebuilt on
 * a machine that does not have them.
 *
 * One request per second. There are 37 files in total, so the whole run is
 * well under a minute, and a public bucket being asked for a few dozen small
 * files at walking pace needs no more justification than that.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const BASE = 'https://rf2-ui-images-prod.s3.eu-west-1.amazonaws.com';

/** `dr` is the driver rating, `sr` the safety rating. */
const KINDS = ['dr', 'sr'] as const;
const RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
/** Tier 0 exists in the bucket and stands for a rank carrying no tier. */
const TIERS = [0, 1, 2, 3] as const;
const BADGES = [
  'sr-noob',
  'sr-saint',
  'sr-clean',
  'sr-warning',
  'sr-probation',
] as const;

/**
 * Outside src/ and gitignored (`.cache`): build inputs, not app assets. Kept
 * in step with build-lmu-sprite.cjs, which reads from the same place.
 */
const CACHE_DIR = path.resolve('tools/.cache/lmu-rank-art');
const RANK_DIR = path.join(CACHE_DIR, 'drsr');
const BADGE_DIR = path.join(CACHE_DIR, 'badges');

const REQUEST_INTERVAL_MS = 1000;
const TIMEOUT_MS = 15_000;

interface Target {
  url: string;
  file: string;
}

const targets = (): Target[] => {
  const out: Target[] = [];
  for (const kind of KINDS) {
    for (const rank of RANKS) {
      for (const tier of TIERS) {
        out.push({
          url: `${BASE}/ranks/${kind}-lmu/${rank}${tier}-small.svg`,
          file: path.join(RANK_DIR, `${kind}-${rank}${tier}.svg`),
        });
      }
    }
  }
  for (const badge of BADGES) {
    out.push({
      url: `${BASE}/badges/${badge}.svg`,
      file: path.join(BADGE_DIR, `${badge}.svg`),
    });
  }
  return out;
};

const get = (url: string): Promise<{ status: number; body: Buffer }> =>
  new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: TIMEOUT_MS }, (response) => {
      const status = response.statusCode ?? 0;
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolve({ status, body: Buffer.concat(chunks) })
      );
      response.on('error', reject);
    });
    request.on('timeout', () => {
      request.destroy(new Error(`timeout after ${TIMEOUT_MS}ms`));
    });
    request.on('error', reject);
  });

/**
 * Rejects anything that is not a plain SVG.
 *
 * These files are third-party downloads that end up rendered in the app, so
 * what arrives is checked rather than trusted. They are referenced as image
 * sources, which already prevents script in them from running, but a file that
 * is not an SVG at all -- a bucket error page, say -- should fail the fetch
 * rather than be committed as artwork.
 */
const checkSvg = (body: Buffer): string | null => {
  const text = body.toString('utf8');
  if (!text.includes('<svg')) return 'not an SVG';
  if (/<script[\s>]/i.test(text)) return 'contains <script>';
  if (/\son\w+\s*=/i.test(text)) return 'contains an inline event handler';
  return null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const force = process.argv.includes('--force');
  fs.mkdirSync(RANK_DIR, { recursive: true });
  fs.mkdirSync(BADGE_DIR, { recursive: true });

  const all = targets();
  let fetched = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const [index, target] of all.entries()) {
    const name = path.basename(target.file);
    if (!force && fs.existsSync(target.file)) {
      skipped += 1;
      continue;
    }
    // Paced before the request, not after, so a run of cache hits does not
    // sit here doing nothing.
    if (fetched > 0) await sleep(REQUEST_INTERVAL_MS);

    process.stdout.write(`[${index + 1}/${all.length}] ${name} ... `);
    try {
      const { status, body } = await get(target.url);
      if (status !== 200) {
        process.stdout.write(`HTTP ${status}\n`);
        failures.push(`${name}: HTTP ${status}`);
        fetched += 1;
        continue;
      }
      const problem = checkSvg(body);
      if (problem) {
        process.stdout.write(`rejected (${problem})\n`);
        failures.push(`${name}: ${problem}`);
        fetched += 1;
        continue;
      }
      fs.writeFileSync(target.file, body);
      process.stdout.write(`${body.length} bytes\n`);
      fetched += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      process.stdout.write(`failed (${reason})\n`);
      failures.push(`${name}: ${reason}`);
      fetched += 1;
    }
  }

  console.log(
    `\nFetched ${fetched - failures.length}, skipped ${skipped} already present, ${failures.length} failed.`
  );
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  ${failure}`);
    // Not a non-zero exit: a tier or badge the bucket does not carry is a fact
    // about the bucket, and the rest of the set is still worth having.
    console.log(
      '\nA missing file means that combination has no artwork; the renderer\n' +
        'falls back to the text chip for it.'
    );
  }
}

void main();
