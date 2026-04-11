import { lazy, Suspense } from 'react';
import { GithubLogo } from '@phosphor-icons/react';
import { Hero } from './sections/Hero';
import { Features } from './sections/Features';

import { Community } from './sections/Community';
import { Footer } from './sections/Footer';

const LivePreview = lazy(() =>
  import('./sections/LivePreview').then((m) => ({ default: m.LivePreview }))
);

function PreviewFallback() {
  return (
    <section id="preview" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="h-150 bg-slate-900/40 border border-slate-800/50 rounded-sm flex items-center justify-center">
          <div className="text-slate-500 text-sm uppercase tracking-wide font-bold">
            Loading preview...
          </div>
        </div>
      </div>
    </section>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased">
      <a
        href="https://github.com/tariknz/irdashies"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-4 right-4 z-50 hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-sm border border-slate-700/50 rounded-sm text-slate-300 hover:text-white text-sm font-medium transition-colors"
      >
        <GithubLogo size={20} weight="fill" />
        GitHub
      </a>
      <Hero />
      <Suspense fallback={<PreviewFallback />}>
        <LivePreview />
      </Suspense>
      <Features />
      <Community />
      <Footer />
    </div>
  );
}
