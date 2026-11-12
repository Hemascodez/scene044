// Lowercase s is the supplied logo's Bricolage Grotesque 800 glyph, outlined
// from the OFL-licensed Fontsource font so browser and PNG icons match exactly.
const S =
  "M267 -14Q214 -14 168.5 -3.5Q123 7 89.5 30Q56 53 38.5 91.5Q21 130 24 185L165 197Q167 164 180 142.5Q193 121 216 111Q239 101 272 101Q303 101 325.5 111.5Q348 122 348 147Q348 160 340 168.5Q332 177 310.5 184.5Q289 192 248 202Q197 215 156 228Q115 241 86 259Q57 277 42 303.5Q27 330 27 369Q27 424 56.5 462.5Q86 501 138 521.5Q190 542 258 542Q319 542 372 523Q425 504 455.5 461Q486 418 478 347L340 334Q343 363 332 383.5Q321 404 300 414.5Q279 425 249 425Q215 425 196.5 412.5Q178 400 178 381Q178 366 189.5 355.5Q201 345 225.5 337.5Q250 330 289 321Q323 314 360 303Q397 292 429 273.5Q461 255 481 225Q501 195 501 149Q501 100 474 63Q447 26 395 6Q343 -14 267 -14Z";

/** Static counterpart for favicons, Apple icons and maskable PWA install icons. */
export function SceneAppIcon({
  size = 180,
  padded = false,
}: {
  size?: number;
  padded?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={padded ? "-24 -24 168 168" : "-2 -2 124 124"}
      role="img"
      aria-label="SCENE"
    >
      <path fill="#0a0808" d="M-24-24h168v168H-24z" />
      <path
        fill="#ff3b2f"
        d="M30 0h60q30 0 30 30v19a11 11 0 0 0 0 22v19q0 30-30 30H30Q0 120 0 90V71a11 11 0 0 0 0-22V30Q0 0 30 0Z"
      />
      <g transform="translate(36.126 92) scale(.092 -.092)">
        <path fill="white" d={S} />
      </g>
      <path
        fill="#ffd23f"
        d="M97 14c1.3 9.1 3.9 11.7 13 13-9.1 1.3-11.7 3.9-13 13-1.3-9.1-3.9-11.7-13-13 9.1-1.3 11.7-3.9 13-13Z"
      />
      <circle cx="20" cy="26" r="3.2" fill="#ffd23f" />
    </svg>
  );
}
