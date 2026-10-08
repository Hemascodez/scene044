export interface RoomPhoto {
  src: string;
  alt: string;
}

/** A host's replacement is authoritative, not hidden behind the design album. */
export function venueRoomPhotos(image: string, name: string, designPhotos: readonly RoomPhoto[] = [], savedPhotos: readonly string[] = []): RoomPhoto[] {
  if (savedPhotos.length) return [...new Set([image, ...savedPhotos].filter(Boolean))].map((src, i) => ({ src, alt: `${name} photo ${i + 1}` }));
  if (!image) return [...designPhotos];
  if (!designPhotos.some(photo => photo.src === image)) return [{ src: image, alt: name }];
  return [{ src: image, alt: designPhotos.find(photo => photo.src === image)!.alt },
    ...designPhotos.filter(photo => photo.src !== image)];
}
