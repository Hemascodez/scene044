'use client';

import { useEffect, useRef, useState } from 'react';

/** Keep the existing map layout, but never leave a silent blank rectangle on
 * a slow connection. Cross-origin map contents cannot be inspected reliably. */
export function VenueMap({ src, title, className }: { src: string; title: string; className: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    const node = container.current;
    if (!('IntersectionObserver' in window)) { const timer = setTimeout(() => setVisible(true),0); return () => clearTimeout(timer); }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin:'200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || loaded) return;
    const timer = setTimeout(() => setSlow(true),12000);
    return () => clearTimeout(timer);
  }, [visible,loaded,attempt]);
  return <div ref={container} className="relative">
    <iframe key={`${src}-${visible}-${attempt}`} title={title} src={visible ? src : undefined} loading="eager"
      referrerPolicy="no-referrer-when-downgrade" allowFullScreen className={className} onLoad={() => { if (visible) setLoaded(true); }} />
    {!loaded && <div className="absolute inset-0 grid place-content-center bg-sand px-4 pb-14 text-center text-sm text-stone">
      <p role="status">{slow ? 'The map is taking longer to load. You can also open Google Maps below.' : 'Loading map…'}</p>
      {slow && <button type="button" onClick={() => { setLoaded(false); setSlow(false); setAttempt(n => n + 1); }} className="press mx-auto mt-3 min-h-11 border-[1.5px] border-ink bg-white px-4 py-2 font-semibold text-ink">Retry map</button>}
    </div>}
  </div>;
}
