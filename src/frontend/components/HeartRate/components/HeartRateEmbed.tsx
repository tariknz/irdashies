import { memo, useEffect, useRef } from 'react';
import { buildHyperateEmbedUrl } from '../hyperateUrl';

interface HeartRateEmbedProps {
  deviceId: string;
  /** Optional HypeRate widget URL or name; blank uses the default overlay. */
  widgetUrl?: string;
}

// HypeRate widgets render at a fixed design size with absolutely-positioned
// content, so a smaller viewport crops them. We render the page into a large
// off-fit viewport, measure the graphic's bounding box inside the guest, then
// CSS-transform the <webview> so just that graphic is scaled to fit our widget
// (the rest is clipped). This makes the whole graphic show and scale on resize.
const MEASURE = 1280;

const TRANSPARENT_CSS =
  'html,body{background:transparent!important;background-color:transparent!important;' +
  'margin:0!important;overflow:hidden!important;}' +
  '::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}';

// Returns the bounding box of the visible graphic, ignoring full-viewport
// wrapper elements. Runs in the guest page's own context.
const MEASURE_JS = `(() => {
  try {
    const vw = innerWidth, vh = innerHeight;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,found=false;
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) continue;
      const r = el.getBoundingClientRect();
      if (r.width<=1||r.height<=1) continue;
      if (r.width>=vw*0.98&&r.height>=vh*0.98) continue;
      if (r.right<=0||r.bottom<=0||r.left>=vw||r.top>=vh) continue;
      if (r.left<minX)minX=r.left; if (r.top<minY)minY=r.top;
      if (r.right>maxX)maxX=r.right; if (r.bottom>maxY)maxY=r.bottom;
      found=true;
    }
    if (!found) return null;
    minX=Math.max(0,minX); minY=Math.max(0,minY);
    maxX=Math.min(vw,maxX); maxY=Math.min(vh,maxY);
    return { x: minX, y: minY, w: maxX-minX, h: maxY-minY };
  } catch { return null; }
})()`;

interface WebviewElement extends HTMLElement {
  insertCSS(css: string): Promise<string>;
  executeJavaScript(code: string): Promise<unknown>;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const isBox = (v: unknown): v is Box =>
  typeof v === 'object' &&
  v !== null &&
  (['x', 'y', 'w', 'h'] as const).every(
    (k) => typeof (v as Record<string, unknown>)[k] === 'number'
  );

const isElectron =
  typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);

const unionBox = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
};

export const HeartRateEmbed = memo(
  ({ deviceId, widgetUrl }: HeartRateEmbedProps) => {
    const src = buildHyperateEmbedUrl(deviceId, widgetUrl);
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isElectron) return;
      const host = hostRef.current;
      if (!host) return;

      const webview = document.createElement('webview') as WebviewElement;
      // Persistent partition isolates HypeRate's cookies/cache/storage from
      // the app's own renderer session.
      webview.setAttribute('partition', 'persist:hyperate');
      webview.setAttribute('src', src);
      Object.assign(webview.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: `${MEASURE}px`,
        height: `${MEASURE}px`,
        transformOrigin: '0 0',
        background: 'transparent',
      });

      // Default to fitting the whole measuring viewport until we've measured.
      let box: Box = { x: 0, y: 0, w: MEASURE, h: MEASURE };
      let measured = false;

      const applyFit = () => {
        const cw = host.clientWidth;
        const ch = host.clientHeight;
        if (!cw || !ch || !box.w || !box.h) return;
        const s = Math.min(cw / box.w, ch / box.h);
        const tx = (cw - box.w * s) / 2 - box.x * s;
        const ty = (ch - box.h * s) / 2 - box.y * s;
        webview.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      };

      const sample = () => {
        webview
          .executeJavaScript(MEASURE_JS)
          .then((res) => {
            if (!isBox(res) || res.w <= 0 || res.h <= 0) return;
            // Union successive samples so animated widgets (e.g. a bouncing
            // heart) aren't clipped at their peak.
            box = measured ? unionBox(box, res) : res;
            measured = true;
            applyFit();
          })
          .catch(() => {
            // guest navigated away mid-measure — ignore
          });
      };

      const timers: ReturnType<typeof setTimeout>[] = [];
      const onReady = () => {
        webview.insertCSS(TRANSPARENT_CSS).catch(() => {
          // guest navigated away before CSS applied — ignore
        });
        [50, 300, 700, 1300].forEach((d) => timers.push(setTimeout(sample, d)));
      };

      webview.addEventListener('dom-ready', onReady);
      host.appendChild(webview);

      const ro = new ResizeObserver(applyFit);
      ro.observe(host);

      return () => {
        timers.forEach(clearTimeout);
        ro.disconnect();
        webview.removeEventListener('dom-ready', onReady);
        webview.remove();
      };
    }, [src]);

    return (
      <div
        ref={hostRef}
        className="relative h-full w-full overflow-hidden bg-transparent"
      >
        {!isElectron && (
          <iframe
            src={src}
            title="HypeRate heart rate"
            scrolling="no"
            allow="autoplay"
            className="absolute inset-0 block h-full w-full border-0 bg-transparent"
          />
        )}
      </div>
    );
  }
);

HeartRateEmbed.displayName = 'HeartRateEmbed';
