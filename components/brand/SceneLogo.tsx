"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type SceneLogoVariant = "light" | "dark" | "red";
export const SCENE_LOGO_COLORS = {
  light: { ticket: "#e0301f", text: "#fff6ee", spark: "#14130f" },
  dark: { ticket: "#ff3b2f", text: "#ffffff", spark: "#ffd23f" },
  red: { ticket: "#14130f", text: "#fff6ee", spark: "#ffffff" },
} as const;

const SPARK =
  "M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10Z";

/** Faithful vector port of the supplied Scene logo artboard, not its mockup runtime. */
export function SceneLogo({
  variant = "light",
  className = "h-9 w-auto",
  animated = true,
}: {
  variant?: SceneLogoVariant;
  className?: string;
  animated?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;
  const color = SCENE_LOGO_COLORS[variant];
  return (
    <svg
      role="img"
      aria-label="SCENE"
      focusable="false"
      viewBox="0 0 460 190"
      width="460"
      height="190"
      className={`block shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <mask
          id={`${id}-ticket`}
          maskUnits="userSpaceOnUse"
          x="-10"
          y="-10"
          width="440"
          height="160"
        >
          <rect x="-10" y="-10" width="440" height="160" fill="white" />
          <circle cx="0" cy="70" r="15" fill="black" />
          <circle cx="420" cy="70" r="15" fill="black" />
        </mask>
        <symbol id={`${id}-spark`} viewBox="-10 -10 20 20">
          <path d={SPARK} />
        </symbol>
      </defs>
      <motion.g
        initial={false}
        animate={{ rotate: moving ? [0, -3, 0] : 0 }}
        transition={{ duration: 5, ease: "easeInOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <g transform="translate(20 28) rotate(-4 210 70)">
          <g mask={`url(#${id}-ticket)`}>
            <rect width="420" height="140" rx="24" fill={color.ticket} />
          </g>
          <rect
            x="10"
            y="10"
            width="400"
            height="120"
            rx="16"
            fill="none"
            stroke={color.text}
            strokeWidth="1.6"
            opacity=".3"
          />
          <text
            x="28"
            y="101"
            fontFamily="'Bricolage Grotesque Variable', system-ui, sans-serif"
            fontSize="104"
            fontWeight="800"
            letterSpacing="-4"
            textLength="296"
            lengthAdjust="spacing"
            fill={color.text}
          >
            scene
          </text>
          <line
            x1="352"
            y1="22"
            x2="352"
            y2="118"
            stroke={color.text}
            strokeWidth="2.5"
            strokeDasharray="2 8"
            strokeLinecap="round"
            opacity=".6"
          />
          <use
            href={`#${id}-spark`}
            x="366"
            y="53"
            width="34"
            height="34"
            fill={color.text}
          />
        </g>
      </motion.g>
      {[0, 1, 2, 3].map((index) => (
        <motion.g
          key={index}
          initial={false}
          animate={{
            opacity: moving ? [1, 0.35, 1] : 1,
            scale: moving ? [1, 0.6, 1] : 1,
            rotate: moving ? [0, 20, 0] : 0,
          }}
          transition={{
            duration: 2.6,
            delay: [0, 0.9, 1.7, 0][index],
            ease: "easeInOut",
          }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          {index < 2 ? (
            <use
              href={`#${id}-spark`}
              x={index === 0 ? 2 : 428}
              y={index === 0 ? 2 : 150}
              width={index === 0 ? 26 : 22}
              height={index === 0 ? 26 : 22}
              fill={color.spark}
            />
          ) : (
            <circle
              cx={index === 2 ? 444 : 24}
              cy={index === 2 ? 34 : 174}
              r={index === 2 ? 4 : 3.5}
              fill={color.spark}
            />
          )}
        </motion.g>
      ))}
    </svg>
  );
}
