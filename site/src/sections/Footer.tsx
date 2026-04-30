import { GithubLogo, DiscordLogo } from '@phosphor-icons/react';

export function Footer() {
  return (
    <footer className="relative border-t border-slate-800/50 py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left — branding */}
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="irDashies" className="w-7 h-7" />
          <p className="text-sm font-bold text-white">irDashies</p>
        </div>

        {/* Center — links */}
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/tariknz/irdashies"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
          >
            <GithubLogo size={16} />
            GitHub
          </a>
          <a
            href="https://discord.gg/YMAqduF2Ft"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
          >
            <DiscordLogo size={16} />
            Discord
          </a>
          <a
            href="https://github.com/tariknz/irdashies/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Releases
          </a>
        </div>

        {/* Right — license */}
        <p className="text-xs text-slate-600">Open source. MIT License.</p>
      </div>
    </footer>
  );
}
