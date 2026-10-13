import {
  Monitor,
  Palette,
  Keyboard,
  Wrench,
  Tag,
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
      <div className="text-slate-400 shrink-0 mt-0.5">{icon}</div>
      <div>
        <h3 className="text-sm font-bold text-white mb-0.5">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="relative py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3">
          Beyond the <span className="text-red-600">Overlays</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8 mt-8">
          <Feature
            icon={<UserCircleGear size={20} weight="bold" />}
            title="Layouts & Profiles"
            description="Switch layouts automatically between sessions. Import, export, and share your setup."
          />
          <Feature
            icon={<Palette size={20} weight="bold" />}
            title="Themes & Appearance"
            description="Choose your colours, fonts, and backgrounds. Move and resize widgets to suit your screen."
          />
          <Feature
            icon={<Monitor size={20} weight="bold" />}
            title="OBS & VR"
            description="Each widget has its own browser-source URL for OBS, Streamlabs, or OpenKneeboard."
          />
          <Feature
            icon={<Wrench size={20} weight="bold" />}
            title="Setup Compare"
            description="Save car setup snapshots and compare what changed between runs."
          />
          <Feature
            icon={<Keyboard size={20} weight="bold" />}
            title="Keyboard & Wheel Controls"
            description="Bind keys and controller buttons to toggle widgets, edit layouts, and switch profiles."
          />
          <Feature
            icon={<Tag size={20} weight="bold" />}
            title="Driver Tags"
            description="Mark friends and other drivers with custom colours and icons in Standings and Relative."
          />
        </div>
      </div>
    </section>
  );
}
