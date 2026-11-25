/** Match the stored portrait URL so each edition keeps its own artwork. */
const POSTERS = new Map([
  ["/events/chapter-lounge/poster.jpg", {
    desktop: { src: "/events/chapter-lounge/poster-landscape.png", width: 2880, height: 1280 },
    portrait: { width: 1120, height: 1400 },
    frameClassName: "aspect-[4/5] sm:aspect-[9/4]",
  }],
  ["/events/chapter-lounge/2026-12-06/poster.jpg", {
    desktop: { src: "/events/chapter-lounge/2026-12-06/poster-landscape.png", width: 3200, height: 1800 },
    portrait: { width: 1117, height: 1408 },
    frameClassName: "aspect-[1117/1408] sm:aspect-video",
  }],
]);

export function hostedPosterArtDirection(portraitUrl: string | null | undefined) {
  return POSTERS.get(portraitUrl ?? "") ?? null;
}
