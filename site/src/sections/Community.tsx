import { DiscordLogo } from '@phosphor-icons/react';

export function Community() {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3">
          Join the <span className="text-[#5865F2]">Discord</span>
        </h2>
        <p className="text-slate-400 mb-8 max-w-lg mx-auto">
          Bug reports, feature requests, and setup help. The Discord server is
          where irDashies development happens in the open.
        </p>

        <a
          href="https://discord.gg/YMAqduF2Ft"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold uppercase tracking-wide text-sm rounded-sm transition-colors"
        >
          <DiscordLogo size={20} weight="bold" />
          Join the Server
        </a>
      </div>
    </section>
  );
}
