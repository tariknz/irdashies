import { GithubLogo, DiscordLogo } from '@phosphor-icons/react';

export const AboutSettings = () => {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold mb-4">About</h2>
        <p className="text-slate-300">
          iRacing Dashies is an open-source iRacing Dashboards & Overlays application that helps you customize and enhance your racing experience.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Version</h3>
        <p className="text-slate-300">v0.0.7</p>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Connect</h3>
        
        <a 
          href="https://github.com/tariknz/irdashies" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors w-fit"
        >
          <GithubLogo size={24} weight="bold" />
          <span>GitHub Repository</span>
        </a>

        <a 
          href="https://discord.gg/YMAqduF2Ft" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors w-fit"
        >
          <DiscordLogo size={24} weight="bold" />
          <span>Join our Discord Community</span>
        </a>
      </div>
    </div>
  );
}; 