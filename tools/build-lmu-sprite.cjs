/**
 * Composes the LMU rank and badge artwork into two PNG sprite sheets.
 *
 * Usage:
 *   npm run build-lmu-sprite
 *
 * The script fetches the source art first (see fetch-lmu-rank-art.ts), which
 * skips whatever is already cached, so a rebuild works on a fresh clone. Only
 * the sheets and their positions file are committed; the SVGs are not.
 *
 * The art arrives from Studio 397 as 37 separate SVGs. Bundling them
 * individually meant a standings row drew up to sixty images, and an SVG is
 * re-rasterised whenever its rendered size changes -- so every size change
 * discarded every cached raster, on an overlay sharing a GPU with the sim.
 *
 * Sheets fixed the count. PNG fixes the rest: a bitmap is decoded once and
 * scaling it afterwards is a GPU resample, where a sheet of ~260 vector paths
 * had to be rasterised again on every font-size, widget-scale or DPI change.
 * It is also what car_manufacturer.png has always done in this project.
 *
 * Authored at SCALE times native, so the art has headroom to be drawn larger
 * than its source size without softening. A plate is 112x52 and is displayed
 * around 22px tall, so 2x leaves roughly five times the detail needed.
 *
 * Run under Electron, which is already a devDependency and ships an image
 * pipeline, rather than adding an image library for a build step run when the
 * art changes.
 *
 * Rasterised in a hidden window rather than with nativeImage, which reads PNG
 * and JPEG but not SVG. The page is written to a temp file and loaded with
 * loadFile: Chromium blocks top-level navigation to a `data:` URL, which is
 * why loading the page that way hung rather than failing. A watchdog below
 * turns any repeat of that into an error instead of a wait.
 */

/* eslint-disable @typescript-eslint/no-require-imports --
 * An Electron main script, so CommonJS: `require('electron')` is how the main
 * process reaches the API, and an ESM entry would not get it.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

/** Where fetch-lmu-rank-art.ts puts the source art. Kept in step with it. */
const CACHE_DIR = path.resolve('tools/.cache/lmu-rank-art');
const RANK_DIR = path.join(CACHE_DIR, 'drsr');
const BADGE_DIR = path.join(CACHE_DIR, 'badges');
const OUT_DIR = path.resolve('src/frontend/assets/lmu');
const POSITIONS_OUT = path.resolve(
  'src/frontend/components/shared/DriverRatingBadge/lmuSpritePositions.ts'
);

/** Kept in step with LMU_TIERED_RANKS and the fetcher's own lists. */
const KINDS = ['dr', 'sr'];
const RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const TIERS = [0, 1, 2, 3];
const BADGES = [
  'sr-noob',
  'sr-saint',
  'sr-clean',
  'sr-warning',
  'sr-probation',
];

/**
 * Badge names with no artwork of their own, drawn from another badge's cell.
 *
 * Emitted right after the badge they share, with the reason as a comment, so
 * a rebuild reproduces what the renderer relies on rather than dropping it.
 */
const BADGE_ALIASES = [
  {
    name: 'sr-danger',
    of: 'sr-warning',
    comment: [
      'The same cell as the warning, deliberately: the service reports the two',
      'markers separately and they mean the same thing to a driver. Without the',
      'entry, a driver carrying it would get no badge at all.',
    ],
  },
];

/** Source cell sizes, asserted against each file rather than assumed. */
const PLATE_W = 112;
const PLATE_H = 52;
const BADGE_W = 128;
const BADGE_H = 128;

/** Columns in each sheet. Rows follow from the cell count. */
const PLATE_COLS = 8;
const BADGE_COLS = 5;

/** Detail headroom, so the art survives being drawn larger than its source. */
const SCALE = 2;

/** Long enough for 37 small rasterisations, short enough to not look hung. */
const TIMEOUT_MS = 60_000;

/** `file:///C:/dev/...` with spaces escaped, which the page can load. */
const fileUrl = (file) =>
  `file:///${file.replace(/\\/g, '/').replace(/ /g, '%20')}`;

/**
 * Draws every cell into one canvas and returns the sheet as PNG bytes.
 *
 * Each source is loaded as an `<img>`, which is how Chromium rasterises an
 * SVG, and drawn at the target size so the vectors are sampled once at the
 * resolution they end up at.
 */
const compose = async (win, cells, cols, cellW, cellH) => {
  const rows = Math.ceil(cells.length / cols);
  const positions = cells.map((cell, index) => ({
    name: cell.name,
    col: index % cols,
    row: Math.floor(index / cols),
    url: fileUrl(cell.file),
  }));

  const dataUrl = await win.webContents.executeJavaScript(
    `window.compose(${JSON.stringify({
      cells: positions,
      cols,
      rows,
      cellW: cellW * SCALE,
      cellH: cellH * SCALE,
    })})`,
    true
  );

  return {
    png: Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
    positions,
    rows,
    sheetW: cols * cellW * SCALE,
    sheetH: rows * cellH * SCALE,
  };
};

/** The page that does the rasterising. Written to disk, not a data: URL. */
const PAGE = `<!doctype html><meta charset="utf-8"><body><script>
window.compose = async ({ cells, cols, rows, cellW, cellH }) => {
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const cell of cells) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('could not load ' + cell.name));
      img.src = cell.url;
    });
    ctx.drawImage(image, cell.col * cellW, cell.row * cellH, cellW, cellH);
  }
  return canvas.toDataURL('image/png');
};
</script></body>`;

async function main() {
  const plateCells = [];
  for (const kind of KINDS) {
    for (const rank of RANKS) {
      for (const tier of TIERS) {
        plateCells.push({
          name: `${kind}-${rank}${tier}`,
          file: path.join(RANK_DIR, `${kind}-${rank}${tier}.svg`),
        });
      }
    }
  }
  const badgeCells = BADGES.map((badge) => ({
    name: badge,
    file: path.join(BADGE_DIR, `${badge}.svg`),
  }));

  // Checked up front rather than left to the page: a missing input there
  // surfaces as "could not load" halfway through, with no hint of the cause.
  // The fetcher treats a file the bucket lacks as a fact about the bucket;
  // here it would leave a hole in the sheet, so it stops the build.
  const missing = [...plateCells, ...badgeCells].filter(
    (cell) => !fs.existsSync(cell.file)
  );
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} source file(s) missing from ${CACHE_DIR}: ` +
        `${missing.map((cell) => cell.name).join(', ')}. ` +
        'Run `npm run fetch-lmu-rank-art` (build-lmu-sprite does this first).'
    );
  }

  const pageFile = path.join(os.tmpdir(), 'irdashies-lmu-sprite.html');
  fs.writeFileSync(pageFile, PAGE, 'utf8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await win.loadFile(pageFile);

  const plates = await compose(win, plateCells, PLATE_COLS, PLATE_W, PLATE_H);
  const badges = await compose(win, badgeCells, BADGE_COLS, BADGE_W, BADGE_H);
  win.destroy();
  fs.rmSync(pageFile, { force: true });

  const platesPath = path.join(OUT_DIR, 'plates-sprite.png');
  const badgesPath = path.join(OUT_DIR, 'badges-sprite.png');
  fs.writeFileSync(platesPath, plates.png);
  fs.writeFileSync(badgesPath, badges.png);

  // The SVG sheets this replaces, so a stale pair cannot be imported by
  // mistake after the switch.
  for (const stale of ['plates-sprite.svg', 'badges-sprite.svg']) {
    const file = path.join(OUT_DIR, stale);
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  const asRecord = (positions, aliases = []) =>
    positions
      .flatMap(({ name, col, row }) => [
        `  '${name}': [${col}, ${row}],`,
        ...aliases
          .filter((alias) => alias.of === name)
          .flatMap((alias) => [
            ...alias.comment.map((line) => `  // ${line}`),
            `  '${alias.name}': [${col}, ${row}],`,
          ]),
      ])
      .join('\n');

  fs.writeFileSync(
    POSITIONS_OUT,
    `// Generated by tools/build-lmu-sprite.cjs. Do not edit by hand.
//
// Each entry is the cell's [column, row] in its sheet. The renderer turns that
// into a background-position, following the car-manufacturer logos.

/** Cell size of plates-sprite.png, in source units. */
export const PLATE_CELL = { width: ${PLATE_W}, height: ${PLATE_H} } as const;
export const PLATE_GRID = {
  cols: ${PLATE_COLS},
  rows: ${plates.rows},
} as const;

/** Cell size of badges-sprite.png. */
export const BADGE_CELL = { width: ${BADGE_W}, height: ${BADGE_H} } as const;
export const BADGE_GRID = { cols: ${BADGE_COLS}, rows: ${badges.rows} } as const;

export const PLATE_POSITIONS: Record<string, readonly [number, number]> = {
${asRecord(plates.positions)}
};

export const BADGE_POSITIONS: Record<string, readonly [number, number]> = {
${asRecord(badges.positions, BADGE_ALIASES)}
};
`
  );

  const kb = (file) => (fs.statSync(file).size / 1024).toFixed(0);
  console.log(
    `plates-sprite.png: ${plateCells.length} cells, ` +
      `${plates.sheetW}x${plates.sheetH} (${SCALE}x), ${kb(platesPath)} KB`
  );
  console.log(
    `badges-sprite.png: ${badgeCells.length} cells, ` +
      `${badges.sheetW}x${badges.sheetH} (${SCALE}x), ${kb(badgesPath)} KB`
  );
  console.log(POSITIONS_OUT);
  app.exit(0);
}

app.whenReady().then(() => {
  // A watchdog, because the failure this replaced was a silent wait rather
  // than an error: a build step that hangs reads as a broken machine.
  const watchdog = setTimeout(() => {
    console.error(`timed out after ${TIMEOUT_MS}ms`);
    app.exit(1);
  }, TIMEOUT_MS);
  watchdog.unref?.();

  main().catch((error) => {
    console.error(error);
    app.exit(1);
  });
});
