export interface RoomPhoto {
  src: string;
  alt: string;
}

/** A host's replacement is authoritative, not hidden behind the design album. */
export function venueRoomPhotos(image: string, name: string, designPhotos: readonly RoomPhoto[] = []): RoomPhoto[] {
  if (!image) return [...designPhotos];
  if (!designPhotos.some(photo => photo.src === image)) return [{ src: image, alt: name }];
  return [{ src: image, alt: designPhotos.find(photo => photo.src === image)!.alt },
    ...designPhotos.filter(photo => photo.src !== image)];
}
