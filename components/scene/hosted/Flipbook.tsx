"use client";

// The flipbook's own lettering, self-hosted and loaded only with this component.
import "@fontsource/pinyon-script/400.css";
import "@fontsource/cormorant-garamond/600.css";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { useStageScale } from "@/lib/client/useStageScale";
import styles from "@/components/scene/hosted/Flipbook.module.css";

/**
 * "Last time" photos as a flipbook, ported from the "Previous events book
 * flip" design: a maroon and gold cover opens and the pages turn on their own.
 * Holds up to seven photos (pages I–VII); the last page invites the reader in.
 *
 * Moving content needs a way to stop it (WCAG 2.2.2), so there's a Pause
 * button, and the book also pauses while it's off screen.
 */

const STAGE_W = 640;
const STAGE_H = 490;
const ACCENT = "#6b1f1f";
const GOLD = "#e0bd66";
const GOLD_DARK = "#8a6a1f";
const INK_BROWN = "#6b5a3a";
const SPINE = "#3e1111";
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

type Photo = { src: string; alt: string };

export function Flipbook({ photos }: { photos: Photo[] }) {
  const { frameRef, scale } = useStageScale<HTMLDivElement>(STAGE_W);
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);

  const pages = photos.slice(0, 7);
  const page = (i: number): ReactNode =>
    pages[i] ? (
      <PhotoPage photo={pages[i]} numeral={NUMERALS[i]} side={i % 2 === 0 ? "front" : "back"} />
    ) : (
      <BlankPage side={i % 2 === 0 ? "front" : "back"} />
    );

  return (
    <div>
      <ul className="sr-only">
        {pages.map((photo) => (
          <li key={photo.src}>{photo.alt}</li>
        ))}
      </ul>

      <div ref={frameRef} className="relative w-full" style={{ height: STAGE_H * scale }} aria-hidden>
        <div
          className={styles.stage}
          data-paused={paused || offscreen}
          style={{ transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
        >
          <div className={styles.artboard}>
            <FrameDefs />
            <div
              style={{
                position: "absolute",
                left: 150,
                top: 500,
                width: 580,
                height: 50,
                borderRadius: "50%",
                background: "radial-gradient(ellipse at center, rgba(40,10,10,.35), rgba(40,10,10,0) 70%)",
              }}
            />
            <div className={styles.fade} style={{ position: "absolute", left: 0, top: 0, width: 880, height: 620 }}>
              <div style={{ position: "absolute", inset: 0, perspective: 2200, perspectiveOrigin: "50% 35%" }}>
                <div style={{ position: "absolute", left: 140, top: 110, width: 600, height: 400, transformStyle: "preserve-3d", transform: "rotateX(12deg)" }}>
                  <div className={styles.shift} style={{ position: "absolute", left: 0, top: 0, width: 600, height: 400, transformStyle: "preserve-3d" }}>
                    <div
                      style={{ position: "absolute", left: 300, top: -6, width: 308, height: 412, borderRadius: "0 6px 6px 0", background: SPINE, transform: "translateZ(-14px)" }}
                    />

                    <Leaf className={styles.lf4} front={page(6)} back={<EndPage />} />
                    <Leaf className={styles.lf3} front={page(4)} back={page(5)} />
                    <Leaf className={styles.lf2} front={page(2)} back={page(3)} />
                    <Leaf className={styles.lf1} front={page(0)} back={page(1)} />
                    <Leaf className={styles.lf0} front={<Cover />} back={<OpeningPage />} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!reduceMotion && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="mt-2 inline-flex min-h-11 items-center gap-2 border-2 border-foreground px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {paused ? "Play the book" : "Pause the book"}
        </button>
      )}
    </div>
  );
}

function Leaf({ className, front, back }: { className: string; front: ReactNode; back: ReactNode }) {
  return (
    <div className={`${styles.leaf} ${className}`}>
      {front}
      {back}
    </div>
  );
}

function PhotoPage({ photo, numeral, side }: { photo: Photo; numeral: string; side: "front" | "back" }) {
  return (
    <div className={`${styles.face} ${side === "back" ? styles.back : ""}`}>
      <div className={styles.photo}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static local photos inside a 3D transform */}
        <img src={photo.src} alt="" loading="lazy" decoding="async" />
      </div>
      <div className={styles.pageNo}>{numeral}</div>
      <div className={side === "back" ? styles.shadeL : styles.shadeR} />
    </div>
  );
}

function BlankPage({ side }: { side: "front" | "back" }) {
  return <div className={`${styles.face} ${side === "back" ? styles.back : ""}`} />;
}

const centred: CSSProperties = {
  position: "absolute",
  left: 52,
  right: 52,
  top: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

function Cover() {
  return (
    <div
      className={styles.face}
      style={{ background: `radial-gradient(ellipse at 50% 40%, ${ACCENT} 0%, ${SPINE} 130%)`, borderRadius: "0 6px 6px 0", boxShadow: "4px 6px 0 #2a0b0b" }}
    >
      <svg className={styles.frame} width="300" height="400">
        <use href="#fb-frame-g" />
      </svg>
      <div style={centred}>
        <div className={styles.script} style={{ fontSize: 50, lineHeight: 1.05, color: GOLD }}>
          Previous
          <br />
          Readings
        </div>
        <div style={{ marginTop: 20, width: 130, height: 1, background: GOLD }} />
        <div style={{ marginTop: 14, fontWeight: 600, fontSize: 13, letterSpacing: ".3em", color: GOLD }}>SCENE/044</div>
      </div>
    </div>
  );
}

function OpeningPage() {
  return (
    <div className={`${styles.face} ${styles.back}`}>
      <svg className={styles.frame} width="300" height="400">
        <use href="#fb-frame-d" />
      </svg>
      <div style={centred}>
        <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: ".3em", color: INK_BROWN }}>A LOOK BACK</div>
        <div style={{ marginTop: 14, width: 120, height: 1, background: GOLD_DARK }} />
        <div className={styles.script} style={{ marginTop: 18, fontSize: 40, lineHeight: 1.1, color: ACCENT }}>
          Pages from our past sessions.
        </div>
      </div>
      <div className={styles.shadeL} />
    </div>
  );
}

function EndPage() {
  return (
    <div className={`${styles.face} ${styles.back}`}>
      <svg className={styles.frame} width="300" height="400">
        <use href="#fb-frame-d" />
      </svg>
      <div style={centred}>
        <div className={styles.script} style={{ fontSize: 46, lineHeight: 1.1, color: ACCENT }}>
          Be part of the memories.
        </div>
        <div style={{ marginTop: 20, width: 120, height: 1, background: GOLD_DARK }} />
        <div style={{ marginTop: 16, fontWeight: 600, fontSize: 13, letterSpacing: ".3em", color: INK_BROWN }}>SCENE/044</div>
      </div>
      <div className={styles.shadeL} />
    </div>
  );
}

/** The gold ornamental frame (light on the cover, dark inside), from the design. */
function FrameDefs() {
  const swirl = "M2 12 C2 4 11 3 11 8 C11 11 7 11 7 8 M11 8 C11 13 16 14 16 9";
  const frame = (id: string, colour: string, pattern: string) => (
    <symbol id={id} viewBox="0 0 300 400">
      <rect x="10" y="10" width="280" height="380" fill="none" stroke={colour} strokeWidth="1.6" />
      <path fillRule="evenodd" fill={`url(#${pattern})`} d="M16 16H284V384H16Z M34 34V366H266V34Z" />
      <rect x="36" y="36" width="228" height="328" fill="none" stroke={colour} strokeWidth="1" />
      <g fill={colour}>
        <circle cx="25" cy="25" r="4" />
        <circle cx="275" cy="25" r="4" />
        <circle cx="25" cy="375" r="4" />
        <circle cx="275" cy="375" r="4" />
      </g>
    </symbol>
  );
  return (
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <pattern id="fb-sg" x="16" y="16" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d={swirl} fill="none" stroke={GOLD} strokeWidth="1.2" />
        </pattern>
        <pattern id="fb-sd" x="16" y="16" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d={swirl} fill="none" stroke={GOLD_DARK} strokeWidth="1.2" />
        </pattern>
        {frame("fb-frame-g", GOLD, "fb-sg")}
        {frame("fb-frame-d", GOLD_DARK, "fb-sd")}
      </defs>
    </svg>
  );
}
