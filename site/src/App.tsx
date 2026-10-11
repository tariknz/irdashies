import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
    <section className="py-8 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-4">
          See It In <span className="text-red-600">Action</span>
        </h2>
        <div className="h-100 lg:h-160 bg-slate-900/40 border border-slate-800/50 rounded-sm flex items-center justify-center">
          <div role="status" className="text-slate-400 text-sm">
            Loading preview...
          </div>
        </div>
      </div>
    </section>
  );
}

function DeferredPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div id="preview" ref={containerRef}>
      <Suspense fallback={<PreviewFallback />}>
        {visible ? <LivePreview /> : <PreviewFallback />}
      </Suspense>
    </div>
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
      <DeferredPreview />
      <Features />
      <Community />
      <Footer />
    </div>
  );
}
