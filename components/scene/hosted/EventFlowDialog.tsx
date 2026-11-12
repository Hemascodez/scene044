"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";

/** Existing SCENE modal patterns, with the keyboard's actual viewport and no fixed form footer. */
export function EventFlowDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const titleId = useId();
  useEffect(() => { const timer = setTimeout(() => setReady(true), 0); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    if (!open || !ready) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => {
      setViewport({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
      requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLInputElement && panel.current?.contains(focused)) focused.scrollIntoView({ block: "nearest", behavior: "auto" });
      });
    };
    const initial = requestAnimationFrame(() => { update(); panel.current?.focus({ preventScroll: true }); });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const fields = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
      if (!fields.length) { event.preventDefault(); return; }
      const first = fields[0], last = fields.at(-1)!;
      if (!panel.current?.contains(document.activeElement) || document.activeElement === panel.current || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    };
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(initial);
      document.body.style.overflow = overflow;
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, ready]);
  if (!ready) return null;
  return createPortal(<MotionConfig reducedMotion="user"><AnimatePresence>{open && <motion.div
    className="hosted-surface fixed inset-x-0 z-[80] flex items-start justify-center overflow-hidden bg-black/75 px-3 py-3 backdrop-blur-sm sm:items-center sm:p-6"
    style={{ top: viewport?.top ?? 0, height: viewport?.height ?? "100dvh", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
    onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
  ><motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
    className="hosted-dark relative min-h-0 max-h-full w-full max-w-md touch-pan-y overflow-y-auto overscroll-contain border border-white/20 p-4 text-[#f4f2ea] shadow-2xl outline-none sm:p-6"
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}
    onFocusCapture={e => { if (e.target instanceof HTMLInputElement) { const input = e.target; requestAnimationFrame(() => input.scrollIntoView({ block: "nearest", behavior: "auto" })); } }}
  >
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 id={titleId} className="pt-2 font-display text-xl font-black leading-tight">{title}</h2>
      <button type="button" aria-label="Close registration" onClick={onClose} className="grid min-h-11 min-w-11 shrink-0 place-items-center border border-white/20 text-2xl hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">×</button>
    </div>
    {children}
  </motion.div></motion.div>}</AnimatePresence></MotionConfig>, document.body);
}
