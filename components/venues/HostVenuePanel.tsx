'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HostApiError,
  fetchHostVenue,
  updateHostSpacePhoto,
  updateHostVenuePhotos,
  uploadHostVenuePhoto,
} from '@/lib/client/hostApi';
import type { AdminSpace, AdminVenue } from '@/lib/client/venueAdminApi';

const label = 'font-mono-b text-[10px] uppercase tracking-[0.1em] text-stone';
const btn = 'press border-[1.5px] border-ink px-3 py-1.5 font-mono-b text-[11px] uppercase tracking-[0.06em] disabled:opacity-50';

/** Space rates are stored in whole rupees (unlike menu prices, which are paise). */
function rupees(amount: number | null) {
  return amount === null ? null : `₹${amount.toLocaleString('en-IN')}`;
}

/** The rates a room can show; a null rate is quote-only and must never read as free. */
function spaceRate(space: AdminSpace) {
  const community = rupees(space.communityRate);
  const production = rupees(space.productionRate);
  if (!community && !production) return 'Rate on request';
  if (community === production) return `${community} per event`;
  return [community && `${community} community`, production && `${production} production`].filter(Boolean).join(' · ');
}

/**
 * Lets a host manage what organisers actually see: the venue's photo gallery and
 * the rooms that can be booked. Photo edits are held as a draft so a mis-click
 * is recoverable; each room's image saves on its own because it is one discrete
 * swap. Host-scoped endpoints select the owning venue on the server, so these
 * changes work with an approved host sign-in as well as a curator preview.
 */
export function HostVenuePanel({ slug }: { slug: string }) {
  const [venue, setVenue] = useState<AdminVenue | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [spaceBusyId, setSpaceBusyId] = useState<number | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const spaceInput = useRef<HTMLInputElement>(null);
  const spaceTarget = useRef<AdminSpace | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { venue: mine } = await fetchHostVenue();
        if (!active) return;
        if (!mine) throw new Error(`No venue found for “${slug}”.`);
        setVenue(mine);
        setPhotos(mine.photos);
      } catch (e) {
        if (!active) return;
        setError(
          e instanceof HostApiError && (e.status === 401 || e.status === 403)
            ? 'Contact your Time Cafe admin to add your number to sign in.'
            : e instanceof Error
              ? e.message
              : 'Could not load your venue',
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const dirty = venue ? photos.join('\u0000') !== venue.photos.join('\u0000') : false;

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPhotos(next);
    setNotice('');
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const urls = await Promise.all([...files].map(uploadHostVenuePhoto));
      setPhotos((list) => [...list, ...urls]);
      setNotice(`${urls.length} photo${urls.length > 1 ? 's' : ''} added — save to publish.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (galleryInput.current) galleryInput.current.value = '';
    }
  }

  async function savePhotos() {
    if (!venue) return;
    setBusy(true);
    setError('');
    try {
      const { venue: saved } = await updateHostVenuePhotos(photos);
      setVenue(saved);
      setPhotos(saved.photos);
      setNotice('Gallery published. Organisers see it on your venue page now.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the gallery');
    } finally {
      setBusy(false);
    }
  }

  async function replaceSpaceImage(files: FileList | null) {
    const space = spaceTarget.current;
    if (!files?.length || !space || !venue) return;
    setSpaceBusyId(space.rowId);
    setError('');
    setNotice('');
    try {
      const image = await uploadHostVenuePhoto(files[0]);
      await updateHostSpacePhoto(space.rowId, image);
      setVenue((v) =>
        v ? { ...v, spaces: v.spaces.map((s) => (s.rowId === space.rowId ? { ...s, image } : s)) } : v,
      );
      setNotice(`${space.name} photo updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the room photo');
    } finally {
      setSpaceBusyId(null);
      spaceTarget.current = null;
      if (spaceInput.current) spaceInput.current.value = '';
    }
  }

  if (loading) return <p className="text-sm text-stone">Loading your venue…</p>;
  if (!venue) {
    return (
      <p role="alert" className="border-[1.5px] border-primary-ink bg-flame/10 px-3 py-2 text-sm font-semibold text-primary-ink">
        {error || 'Could not load your venue.'}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="border-[1.5px] border-primary-ink bg-flame/10 px-3 py-2 text-sm font-semibold text-primary-ink">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="border-[1.5px] border-moss/50 bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">
          {notice}
        </p>
      )}

      {/* Gallery */}
      <section className="border-[1.5px] border-ink bg-white shadow-hard">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-ink px-5 py-4">
          <div>
            <h2 className="font-head text-lg text-ink">Venue photos</h2>
            <p className="mt-0.5 text-sm text-stone">
              The first photo is the cover organisers see in search.{' '}
              <a href={`/venues/${venue.slug}`} target="_blank" rel="noreferrer" className="font-body-sb text-ink underline underline-offset-4 hover:text-flame">
                View your page
              </a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <button type="button" disabled={busy} onClick={() => { setPhotos(venue.photos); setNotice(''); }} className={`${btn} bg-white text-ink`}>
                Discard
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => galleryInput.current?.click()} className={`${btn} bg-white text-ink`}>
              {busy ? 'Working…' : 'Add photos'}
            </button>
            <button type="button" disabled={busy || !dirty} onClick={savePhotos} className={`${btn} bg-flame text-white shadow-hard-sm`}>
              Save changes
            </button>
          </div>
        </div>

        <input
          ref={galleryInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => void addPhotos(e.target.files)}
        />

        <div className="p-5">
          {photos.length === 0 ? (
            <p className="border-[1.5px] border-dashed border-ink/40 bg-paper px-4 py-8 text-center text-sm text-stone">
              No photos yet. Organisers are far more likely to book a space they can see — add a few of the room, the
              light, and the entrance.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((src, i) => (
                <li key={`${src}-${i}`} className="border-[1.5px] border-ink bg-paper">
                  <div className="relative aspect-[4/3] bg-sand">
                    {/* Uploads are served from /api/poster/<id>, which next/image
                        has no loader for — a plain img keeps both sources working. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${venue.name} photo ${i + 1}`} className="size-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-2 top-2 border border-ink bg-white px-1.5 py-0.5 font-mono-b text-[10px] uppercase tracking-[0.1em] text-ink">
                        Cover
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t-[1.5px] border-ink px-2 py-1.5">
                    <div className="flex gap-1">
                      <button type="button" disabled={busy || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move photo ${i + 1} earlier`} className={`${btn} bg-white text-ink px-2`}>
                        ←
                      </button>
                      <button type="button" disabled={busy || i === photos.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move photo ${i + 1} later`} className={`${btn} bg-white text-ink px-2`}>
                        →
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { setPhotos((list) => list.filter((_, n) => n !== i)); setNotice(''); }}
                      className={`${btn} bg-white text-primary-ink`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {dirty && (
            <p className="mt-4 font-mono text-xs text-stone">
              Unsaved changes — nothing is live until you press Save changes.
            </p>
          )}
        </div>
      </section>

      {/* Bookable rooms */}
      <section className="border-[1.5px] border-ink bg-white shadow-hard">
        <div className="border-b-[1.5px] border-ink px-5 py-4">
          <h2 className="font-head text-lg text-ink">Rooms organisers can book</h2>
          <p className="mt-0.5 text-sm text-stone">Each room shows its own photo on your venue page and in the booking form.</p>
        </div>

        <input
          ref={spaceInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => void replaceSpaceImage(e.target.files)}
        />

        <div className="p-5">
          {venue.spaces.length === 0 ? (
            <p className="border-[1.5px] border-dashed border-ink/40 bg-paper px-4 py-8 text-center text-sm text-stone">
              No rooms listed yet. SCENE sets these up with you — message your curator to add one.
            </p>
          ) : (
            <ul className="space-y-4">
              {venue.spaces.map((space) => (
                <li key={space.rowId} className="flex flex-wrap items-center gap-4 border-[1.5px] border-ink bg-paper p-3">
                  <div className="relative size-24 shrink-0 border-[1.5px] border-ink bg-sand">
                    {space.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={space.image} alt={space.name} className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-content-center px-1 text-center font-mono text-[10px] text-stone">No photo</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {space.eyebrow && <p className={label}>{space.eyebrow}</p>}
                    <p className="font-head text-base text-ink">{space.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-stone">
                      {space.capacity || `Up to ${space.maxGuests} guests`} · {spaceRate(space)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={spaceBusyId !== null}
                    onClick={() => { spaceTarget.current = space; spaceInput.current?.click(); }}
                    className={`${btn} bg-white text-ink`}
                  >
                    {spaceBusyId === space.rowId ? 'Uploading…' : space.image ? 'Replace photo' : 'Add photo'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
