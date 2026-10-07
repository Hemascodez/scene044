/** Decode and resize actual uploads; never use a prototype image as an avatar. */
export async function saveVenueProfilePhoto(src: string | null): Promise<void> {
  let body: FormData | undefined;
  if (src) {
    const image = new Image();
    image.src = src;
    await image.decode();
    const ratio = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare your photo. Try again.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare your photo.')), 'image/jpeg', 0.85));
    body = new FormData();
    body.set('photo', blob, 'profile.jpg');
  }
  const response = await fetch('/api/venue-auth/photo', { method: src ? 'POST' : 'DELETE', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Could not save your photo. Please try again.');
}
