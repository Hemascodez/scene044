import { Mono } from "@/components/scene/ui";

/** Shared Figma-derived outcome list for the full page and the feed modal. */
export function EventGlance({ bullets, className = "" }: { bullets: string[]; className?: string }) {
  const hasBullets = bullets.length > 0;

  return (
    <section className={className} aria-labelledby="event-glance-title">
      <div className="flex items-baseline justify-between gap-3">
        <Mono className="text-[10px] text-primary-ink">Quick event guide</Mono>
        <Mono className="text-[10px] text-muted-foreground">
          {hasBullets ? `${String(bullets.length).padStart(2, "0")} things` : "Details pending"}
        </Mono>
      </div>
      <h2 id="event-glance-title" className="mt-1.5 font-display text-xl font-black leading-tight tracking-tight">
        At a glance
      </h2>
      {hasBullets ? (
        <ol className="mt-3 border-2 border-foreground bg-card">
          {bullets.map((bullet, index) => (
            <li
              key={`${index}-${bullet}`}
              className="group/glance flex items-stretch border-b-2 border-foreground last:border-b-0"
            >
              <span
                aria-hidden
                className="flex w-11 shrink-0 items-center justify-center border-r-2 border-foreground bg-foreground font-mono text-sm font-bold text-primary transition-colors group-hover/glance:bg-primary group-hover/glance:text-primary-foreground"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 px-3.5 py-3 text-sm font-medium leading-snug transition-colors group-hover/glance:bg-secondary">
                {bullet}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-3 flex items-start gap-3 border-2 border-foreground bg-secondary px-4 py-3.5">
          <span aria-hidden className="text-lg">✨</span>
          <p className="text-sm leading-relaxed text-foreground/75">
            Session highlights are being verified. Check the original listing for the latest agenda.
          </p>
        </div>
      )}
    </section>
  );
}
