/**
 * Google Analytics 4.
 *
 * Inert unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set, so local development and
 * preview deploys never pollute the property with fake traffic — and so a
 * missing key is a no-op rather than a broken page.
 *
 * Written as a raw gtag snippet rather than pulling in @next/third-parties:
 * this project deliberately runs on four runtime dependencies, and the package
 * would buy us nothing that eight lines of script don't already do.
 *
 * Note on App Router: GA4's Enhanced Measurement tracks page views from
 * browser history events, which covers Next's client-side navigations. If the
 * property is ever configured with Enhanced Measurement off, soft navigations
 * will stop being counted and will need an explicit gtag('event','page_view')
 * on route change.
 */

/** Measurement IDs are G-XXXXXXX. Validated rather than interpolated blindly —
 *  this value lands inside an inline <script>, so it must not carry quotes. */
export function gaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id && /^G-[A-Z0-9]+$/i.test(id) ? id : null;
}

export function gaInlineScript(id: string): string {
  return (
    `window.dataLayer=window.dataLayer||[];` +
    `function gtag(){dataLayer.push(arguments)}` +
    `gtag('js',new Date());` +
    `gtag('config','${id}');`
  );
}
