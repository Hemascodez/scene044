"use client";

// The design's handwriting, self-hosted and loaded only with this component.
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import { useEffect, useState, type CSSProperties } from "react";
import { useStageScale } from "@/lib/client/useStageScale";
import styles from "@/components/scene/hosted/HandwrittenNote.module.css";

/**
 * A reader's review as a handwritten note on a torn, ruled notebook page with
 * washi tape — the owner's "Review handwritten note" design. The note drops in
 * and writes itself word by word when scrolled into view (once). The page is
 * laid out at the design's size (540 × 316) and scaled to fit the column. The
 * text stays real text for screen readers.
 */

const NOTE_W = 540;
const NOTE_H = 316;
const PAD = 28; // room for the tape and the drop shadow
const WORD_MS = 110;

const HOLE: CSSProperties = {
  position: "absolute",
  left: 14,
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "#14130d",
  boxShadow: "inset 0 2px 3px rgba(0,0,0,.6)",
};

/** Words of `text`, each marked if it falls inside `highlight`. */
function words(text: string, highlight?: string) {
  const start = highlight ? text.indexOf(highlight) : -1;
  const end = start >= 0 && highlight ? start + highlight.length : -1;
  let at = 0;
  return text.split(/\s+/).filter(Boolean).map((word) => {
    const from = text.indexOf(word, at);
    at = from + word.length;
    return { word, marked: start >= 0 && from >= start && at <= end };
  });
}

export function HandwrittenNote({ text, by, highlight }: { text: string; by: string; highlight?: string }) {
  const { frameRef, scale } = useStageScale<HTMLDivElement>(NOTE_W + PAD * 2);
  const [play, setPlay] = useState(false);

  // Start writing only when the note is properly on screen: wait for its real
  // size (a zero-height frame can report as "visible"), then need 60% of it in
  // view and clear of the bottom 15% of the screen. Plays once.
  const measured = scale > 0;
  useEffect(() => {
    const node = frameRef.current;
    if (!node || !measured || play) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setPlay(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlay(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6, rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [frameRef, measured, play]);

  const list = words(text, highlight);
  const writeStart = 650; // after the note lands
  const sigDelay = writeStart + list.length * WORD_MS + 200;

  return (
    <figure className="m-0">
      <div ref={frameRef} className="relative w-full" style={{ height: (NOTE_H + PAD * 2) * scale }}>
        <div
          className={styles.stage}
          data-play={play ? "true" : "false"}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: NOTE_W + PAD * 2,
            height: NOTE_H + PAD * 2,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            visibility: scale ? "visible" : "hidden",
          }}
        >
          <div
            className={styles.note}
            style={{ position: "absolute", left: PAD, top: PAD, width: NOTE_W, height: NOTE_H, filter: "drop-shadow(0 22px 26px rgba(0,0,0,.6))" }}
          >
            {/* Torn, ruled notebook page. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#fbf6e9",
                backgroundImage:
                  "linear-gradient(135deg, rgba(255,255,255,.55), rgba(255,255,255,0) 45%), repeating-linear-gradient(180deg, transparent 0 41px, rgba(74,111,170,.28) 41px 42px)",
                backgroundPosition: "0 0, 0 7px",
                WebkitMaskImage: "conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg), linear-gradient(#000, #000)",
                WebkitMaskSize: "16px 8px, 100% calc(100% - 8px)",
                WebkitMaskPosition: "0 0, 0 bottom",
                WebkitMaskRepeat: "repeat-x, no-repeat",
                maskImage: "conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg), linear-gradient(#000, #000)",
                maskSize: "16px 8px, 100% calc(100% - 8px)",
                maskPosition: "0 0, 0 bottom",
                maskRepeat: "repeat-x, no-repeat",
              }}
            >
              <div aria-hidden="true" style={{ position: "absolute", left: 64, top: 0, bottom: 0, width: 2, background: "rgba(214,60,50,.45)" }} />
              <div aria-hidden="true" style={{ ...HOLE, top: 44 }} />
              <div aria-hidden="true" style={{ ...HOLE, top: 140 }} />
              <div aria-hidden="true" style={{ ...HOLE, top: 236 }} />

              <div style={{ position: "absolute", left: 86, right: 34, top: 60, fontFamily: "'Caveat', 'Segoe Script', cursive" }}>
                <blockquote style={{ margin: 0, fontSize: 36, lineHeight: "42px", fontWeight: 500, color: "#1f2a5c" }}>
                  {list.map(({ word, marked }, i) => (
                    <span key={i}>
                      <span
                        className={styles.word}
                        style={{
                          animationDelay: `${writeStart + i * WORD_MS}ms`,
                          ...(marked
                            ? { background: "linear-gradient(transparent 52%, rgba(255,222,89,.75) 52% 92%, transparent 92%)", padding: "0 3px", margin: "0 -3px" }
                            : {}),
                        }}
                      >
                        {word}
                      </span>{" "}
                    </span>
                  ))}
                </blockquote>
                <figcaption
                  className={styles.sig}
                  style={{ marginTop: 42, display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 700, color: "#4a3b2e", whiteSpace: "nowrap", animationDelay: `${sigDelay}ms` }}
                >
                  <span>~ {by.charAt(0).toLowerCase() + by.slice(1)}</span>
                  <svg width="34" height="30" viewBox="0 0 34 30" fill="none" stroke="#d63c32" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path className={styles.heart} style={{ animationDelay: `${sigDelay + 350}ms` }} d="M17 26C6 18 3 12 5.5 7.5 8.5 3 14 4.5 17 9c3-4.5 8.5-6 11.5-1.5C31 12 28 18 17 26z" />
                  </svg>
                </figcaption>
              </div>
            </div>

            {/* Washi tape. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 215,
                top: -14,
                width: 112,
                height: 30,
                transform: "rotate(-3deg)",
                background: "rgba(255,236,170,.6)",
                borderLeft: "2px dashed rgba(255,255,255,.35)",
                borderRight: "2px dashed rgba(255,255,255,.35)",
                boxShadow: "0 2px 4px rgba(0,0,0,.25)",
              }}
            />
          </div>
        </div>
      </div>
    </figure>
  );
}
