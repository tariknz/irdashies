import { DownloadSimple, Play, SlidersHorizontal } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface StepProps {
  number: number;
  icon: ReactNode;
  title: string;
  description: string;
  isLast?: boolean;
}

function Step({ number, icon, title, description, isLast }: StepProps) {
  return (
    <div className="flex-1 relative">
      <div className="flex flex-col items-center text-center">
        {/* Step number + icon */}
        <div className="relative mb-4">
          <div className="w-16 h-16 bg-slate-900 border border-slate-700/50 rounded-sm flex items-center justify-center text-[#f89806]">
            {icon}
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#fa2713] rounded-sm flex items-center justify-center">
            <span className="text-[10px] font-black text-white">{number}</span>
          </div>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wide text-white mb-2">
          {title}
        </h3>
        <p className="text-xs text-slate-400 max-w-[200px]">{description}</p>
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-px bg-slate-700/50">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-700 rotate-45" />
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3 text-center">
          Up and <span className="text-[#f89806]">Running</span> in Minutes
        </h2>
        <p className="text-slate-400 mb-16 text-center max-w-md mx-auto">
          No configuration files, no dependencies. Install and race.
        </p>

        <div className="flex flex-col md:flex-row gap-12 md:gap-8">
          <Step
            number={1}
            icon={<DownloadSimple size={28} weight="bold" />}
            title="Download"
            description="Grab the latest release from GitHub. One installer, auto-updates included."
          />
          <Step
            number={2}
            icon={<Play size={28} weight="bold" />}
            title="Launch"
            description="Start irDashies alongside iRacing. Overlays appear automatically on your screen."
          />
          <Step
            number={3}
            icon={<SlidersHorizontal size={28} weight="bold" />}
            title="Customize"
            description="Resize, reposition, change themes, configure every detail to match your setup."
            isLast
          />
        </div>
      </div>
    </section>
  );
}
