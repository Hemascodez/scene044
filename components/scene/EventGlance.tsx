import type { GlanceFact } from "@/lib/client/sceneEvent";
import { Mono } from "@/components/scene/ui";

/**
 * The block that opens the event page, replacing the long AI description that
 * used to lead it.
 *
 * Three parts, in decreasing certainty: the model's one-sentence `gist`, then
 * facts derived straight from our own columns, then the source-grounded
 * outcomes. The facts sit in the middle on purpose — they are the only part
 * that cannot be wrong, so they anchor the two generated halves around them.
 *
 * Entrance motion is the subtle tier (8px/300ms, 30ms stagger, no overshoot):
 * these are dense informational rows, where a bounce reads as sloppy.
 */
const STAGGER_MS = 30;

function delay(step: number): { animationDelay: string } {
  // Capped so a long block never leaves the last row visibly trailing.
  return { animationDelay: `${Math.min(step, 8) * STAGGER_MS}ms` };
}

export function EventGlance({
  gist,
  facts,
  bullets,
  className = "",
}: {
  gist: string | null;
  facts: GlanceFact[];
  bullets: string[];
  className?: string;
}) {
  if (!gist && facts.length === 0 && bullets.length === 0) return null;

  // The outcome rows continue the same stagger the facts started, so the block
  // reads as one sequence rather than two.
  const bulletsStart = (gist ? 1 : 0) + facts.length;

  return (
    <section className={className} aria-labelledby="event-glance-title">
      <Mono className="text-[10px] text-primary-ink">Quick event guide</Mono>
      <h2
        id="event-glance-title"
        className="mt-1.5 font-display text-xl font-black leading-tight tracking-tight sm:text-2xl"
      >
        At a glance
      </h2>

      <div className="mt-3 border-2 border-foreground bg-card shadow-[5px_5px_0_0_var(--color-foreground)]">
        {gist && (
          <p
            className="scene-rise-tight border-b-2 border-foreground px-4 py-4 text-base font-medium leading-snug sm:text-lg"
            style={delay(0)}
          >
            {gist}
          </p>
        )}

        {facts.length > 0 && (
          <dl className="flex flex-col border-b-2 border-foreground last:border-b-0 sm:flex-row">
            {facts.map((fact, index) => (
              <div
                key={fact.label}
                style={delay((gist ? 1 : 0) + index)}
                className="scene-rise-tight min-w-0 flex-1 border-b-2 border-dashed border-foreground/25 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r-2 sm:border-solid sm:border-foreground sm:last:border-r-0"
              >
                <dt>
                  <Mono className="text-[9px] text-muted-foreground">{fact.label}</Mono>
                </dt>
                <dd className="mt-1 text-sm font-semibold leading-snug">
                  {fact.value}
                  {fact.hint && (
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">{fact.hint}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {bullets.length > 0 && (
          <>
            <div className="border-b-2 border-foreground bg-secondary px-4 py-2.5">
              <Mono className="text-[10px]">What you&apos;ll get</Mono>
            </div>
            <ol>
              {bullets.map((bullet, index) => (
                <li
                  key={`${index}-${bullet}`}
                  style={delay(bulletsStart + index)}
                  className="scene-rise-tight group/glance flex items-stretch border-b-2 border-foreground last:border-b-0"
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
          </>
        )}
      </div>
    </section>
  );
}
