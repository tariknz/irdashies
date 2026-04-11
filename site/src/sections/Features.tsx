import {
  Monitor,
  Palette,
  Keyboard,
  Wrench,
  Tag,
  TwitchLogo,
  Export,
  ArrowsClockwise,
  UserCircleGear,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface FeatureProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function Feature({ icon, title, description }: FeatureProps) {
  return (
    <div className="flex gap-3">
      <div className="text-slate-500 shrink-0 mt-0.5">{icon}</div>
      <div>
        <h3 className="text-sm font-bold text-white mb-0.5">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3">
          Beyond the <span className="text-[#0097dc]">Overlays</span>
        </h2>
        <p className="text-slate-400 mb-12 max-w-xl">
          Customization, streaming tools, and quality-of-life features built
          around how people actually race.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
          <Feature
            icon={<Wrench size={20} weight="bold" />}
            title="Setup Compare"
            description="Snapshot and compare car setups side-by-side. See exactly what changed between runs."
          />
          <Feature
            icon={<Keyboard size={20} weight="bold" />}
            title="Hotkey Bindings"
            description="Global keyboard shortcuts to toggle UI, lock layouts, and capture telemetry without leaving the sim."
          />
          <Feature
            icon={<Tag size={20} weight="bold" />}
            title="Driver Tags"
            description="Tag drivers as friends, streamers, or dangerous. Custom groups with colors and icons show in standings and relative."
          />
          <Feature
            icon={<Monitor size={20} weight="bold" />}
            title="OBS Browser Sources"
            description="Every widget gets its own URL. Use them as browser sources in OBS or Streamlabs."
          />
          <Feature
            icon={<TwitchLogo size={20} weight="bold" />}
            title="Twitch Chat"
            description="Built-in chat overlay with emoji support. No alt-tabbing."
          />
          <Feature
            icon={<Palette size={20} weight="bold" />}
            title="18 Color Themes"
            description="Custom highlight colors, font sizes, weights, and per-widget background opacity."
          />
          <Feature
            icon={<UserCircleGear size={20} weight="bold" />}
            title="Dashboard Profiles"
            description="Save multiple layouts and switch between them. Oval, road, endurance, streaming."
          />
          <Feature
            icon={<Export size={20} weight="bold" />}
            title="Import & Export"
            description="Share layouts or import community configs to get started quickly."
          />
          <Feature
            icon={<ArrowsClockwise size={20} weight="bold" />}
            title="Auto Updates"
            description="Stay on the latest version automatically. No manual downloads after install."
          />
        </div>
      </div>
    </section>
  );
}
