import { useMemo } from 'react';
import { DownloadSimple, CaretDown } from '@phosphor-icons/react';

const SPEED_LINE_WIDTHS = [112, 167, 93, 185, 140, 158];

export function Hero() {
  const speedLineWidths = useMemo(() => SPEED_LINE_WIDTHS, []);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Hero background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 blur-[0.5px] scale-125"
        style={{ backgroundImage: 'url(/hero-bg.webp)' }}
      />
      {/* Dark gradient overlay to blend into page */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950" />

      {/* Racing stripe background */}
      <div className="absolute inset-0 racing-stripe" />

      {/* Speed lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {speedLineWidths.map((width, i) => (
          <div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{
              top: `${15 + i * 14}%`,
              width: `${width}px`,
              animation: `speed-line ${2.5 + i * 0.7}s linear infinite`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
      </div>

      {/* Diagonal cut bottom edge */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 bg-slate-950"
        style={{
          clipPath: 'polygon(0 100%, 100% 0, 100% 100%)',
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/logo.svg"
            alt="irDashies"
            className="w-32 h-32 mx-auto mb-6"
          />
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-2">
            ir<span className="text-[#fa2713]">Dashies</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-base text-slate-400 mb-10 max-w-xl mx-auto">
          Open-source iRacing overlays with real-time telemetry, standings, fuel
          strategy, and 20+ customizable widgets.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/tariknz/irdashies/releases/download/latest/irdashies-0.2.0.Setup.exe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#fa2713] hover:bg-[#d92010] text-white font-bold uppercase tracking-wide text-sm rounded-sm transition-colors"
            >
              <DownloadSimple size={20} weight="bold" />
              Download
            </a>
            <a
              href="#preview"
              className="inline-flex items-center gap-2 px-8 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-bold uppercase tracking-wide text-sm rounded-sm transition-colors"
            >
              See it in action
              <CaretDown size={16} weight="bold" />
            </a>
          </div>
          <a
            href="https://github.com/tariknz/irdashies/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-500 hover:text-slate-300 underline transition-colors"
          >
            Release notes
          </a>
        </div>
      </div>
    </section>
  );
}
