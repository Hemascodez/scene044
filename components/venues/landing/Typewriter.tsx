"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Cycles through the kinds of event a venue can host. The phrases are real
 * entries from VENUE_EVENT_TYPES, so the headline only ever names something the
 * booking form will actually let you pick. Under reduced motion it stays on the
 * first phrase; a screen reader gets the full list once, not the animation.
 */
export function Typewriter({ phrases }: { phrases: readonly string[] }) {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(phrases[0]);

  useEffect(() => {
    if (reduceMotion || phrases.length < 2) return;
    let i = 0;
    let n = phrases[0].length;
    let deleting = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = phrases[i];
      n += deleting ? -1 : 1;
      setText(word.slice(0, n));
      let wait = deleting ? 35 : 80;
      if (!deleting && n === word.length) {
        deleting = true;
        wait = 1600;
      } else if (deleting && n === 0) {
        deleting = false;
        i = (i + 1) % phrases.length;
        wait = 350;
      }
      timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, 1600);
    return () => clearTimeout(timer);
  }, [phrases, reduceMotion]);

  return (
    <>
      <span className="sr-only">{phrases.join(", ")}</span>
      <span aria-hidden className="whitespace-nowrap bg-gradient-to-r from-primary to-[#ff9a3c] bg-clip-text text-transparent">
        {text}
        <span className="venue-caret ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] bg-primary" />
      </span>
    </>
  );
}
