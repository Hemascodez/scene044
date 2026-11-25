"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export const REGISTER_OPEN_EVENT = "hosted-register-open";

/**
 * Phone-only bar that keeps "Register" one thumb away once the registration
 * card has scrolled off screen. Hidden on `sm` and up, while the card is in
 * view, and whenever the card says there's nothing left to do (`hidden`).
 */
export function RegisterBar({
  anchorId,
  priceLabel,
  hidden,
}: {
  anchorId: string;
  priceLabel: string;
  hidden: boolean;
}) {
  const [cardVisible, setCardVisible] = useState(true);

  useEffect(() => {
    const anchor = document.getElementById(anchorId);
    if (!anchor || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCardVisible(entry.isIntersecting), {
      rootMargin: "0px 0px -80px 0px",
    });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorId]);

  function openCard() {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.dispatchEvent(new CustomEvent(REGISTER_OPEN_EVENT));
  }

  const show = !hidden && !cardVisible;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="register-bar"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[var(--h-gold,#14130d)] bg-[var(--h-card,#14130d)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[var(--h-ink,#f4f2ea)] shadow-[0_-12px_30px_-12px_rgba(0,0,0,.6)] sm:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-black leading-none">{priceLabel}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] opacity-75">
                Refreshments included
              </p>
            </div>
            <button
              type="button"
              onClick={openCard}
              className="min-h-11 shrink-0 border-2 border-[var(--h-ink,#f4f2ea)] bg-[var(--h-ink,#f4f2ea)] px-5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--h-on-ink,#14130d)] transition-colors hover:border-[var(--h-accent,#ff2d16)] hover:bg-[var(--h-accent,#ff2d16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-accent,#f4f2ea)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--h-card,#14130d)] active:translate-y-0.5"
            >
              Register
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
