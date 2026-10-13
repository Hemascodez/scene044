import { getImageProps } from 'next/image';
import type { ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  src: string;
  alt: string;
};

/** Same img element and CSS as the approved designs. Originals remain intact;
 * only our own uploaded/static venue photos get responsive delivery variants.
 * External images stay untouched instead of permitting an unrestricted proxy. */
export default function ResponsiveVenueImage({ src, alt, sizes = '(max-width: 768px) 90vw, 640px', ...rest }: Props) {
  const owned = /^\/api\/poster\/\d+$/.test(src) || /^\/(?:venues|stock)\/.+\.(?:png|jpe?g|webp|avif)$/i.test(src);
  // eslint-disable-next-line @next/next/no-img-element -- unknown external sources cannot safely use our image proxy
  if (!owned) return <img src={src} alt={alt} sizes={sizes} {...rest} />;
  const { props } = getImageProps({ src, alt, width: 1600, height: 1200, sizes, quality: 75 });
  // eslint-disable-next-line @next/next/no-img-element -- getImageProps already supplies Next's optimized responsive image URLs
  return <img {...props} alt={alt} {...rest} />;
}
