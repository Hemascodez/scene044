import Link from 'next/link';
import type { CityHub } from '@/lib/cityEvents';
import { cityHubPath } from '@/lib/cityEvents';

export function CityHubLinks({ hubs, label = 'Explore events by city', dark = false }: {
  hubs: readonly (CityHub & { count: number })[]; label?: string; dark?: boolean;
}) {
  if (!hubs.length) return null;
  return <nav aria-label={label} className="mt-6">
    <p className={`font-mono text-[11px] uppercase tracking-[0.1em] ${dark ? 'text-background/70' : 'text-muted-foreground'}`}>{label}</p>
    <ul className="mt-3 flex flex-wrap gap-2">
      {hubs.map(hub => <li key={hub.slug}><Link href={cityHubPath(hub)}
        className={`inline-flex min-h-11 items-center gap-2 border-2 px-3 py-2 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${dark ? 'border-background/40 text-background hover:border-primary hover:text-primary' : 'border-foreground bg-card hover:bg-foreground hover:text-background'}`}>
        {hub.city} events <span className="opacity-70">({hub.count})</span>
      </Link></li>)}
    </ul>
  </nav>;
}
