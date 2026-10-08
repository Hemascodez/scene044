import { pool } from '@/lib/db';
import { getVenueUserFromRequest } from '@/lib/venueUserAuth';
import type { HostSpaceDetails } from '@/lib/venueHostSpaceValidation';

/** Save and alert together: neither can succeed without the other. The caller
 * has authenticated and validated photo ownership; the UPDATE is venue-scoped. */
export async function saveHostPhotos(request: Request, slug: string, value: string[] | string, roomId?: number) {
  const actor = (await getVenueUserFromRequest(request))?.name || 'SCENE curator';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = roomId === undefined
      ? await client.query('SELECT photos AS value FROM venues WHERE slug=$1 FOR UPDATE', [slug])
      : await client.query('SELECT s.image AS value, s.name FROM venue_spaces s JOIN venues v ON v.id=s.venue_id WHERE v.slug=$1 AND s.id=$2 FOR UPDATE OF s', [slug, roomId]);
    if (!rows.length) { await client.query('ROLLBACK'); return false; }
    const before = rows[0].value;
    if (JSON.stringify(before) !== JSON.stringify(value)) {
      if (roomId === undefined) await client.query('UPDATE venues SET photos=$2,updated_at=now() WHERE slug=$1', [slug, value]);
      else await client.query("UPDATE venue_spaces SET image=$3,photos=CASE WHEN cardinality(photos)>0 THEN ARRAY[$3::text] || array_remove(photos,$3::text) ELSE photos END,updated_at=now() WHERE id=$2 AND venue_id=(SELECT id FROM venues WHERE slug=$1)", [slug, roomId, value]);
      await client.query('INSERT INTO venue_host_changes(venue_slug,actor_name,field,before_value,after_value) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',
        [slug, actor, roomId === undefined ? 'Venue gallery / cover' : `${rows[0].name} photo`, JSON.stringify(before), JSON.stringify(value)]);
    }
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** Lock the owning venue, write the catalog and curator alert atomically.
 * New-room request IDs make retries idempotent; existing booking prices stay snapshots. */
export async function saveHostSpace(request: Request, slug: string, details: HostSpaceDetails, target: number | string): Promise<number | null> {
  const actor = (await getVenueUserFromRequest(request))?.name || 'SCENE curator';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: venues } = await client.query('SELECT id FROM venues WHERE slug=$1 FOR UPDATE', [slug]);
    if (!venues.length) { await client.query('ROLLBACK'); return null; }
    const venueId = venues[0].id;
    const { rows: old } = await client.query(typeof target === 'number'
      ? 'SELECT * FROM venue_spaces WHERE venue_id=$1 AND id=$2 AND retired_at IS NULL FOR UPDATE'
      : 'SELECT * FROM venue_spaces WHERE venue_id=$1 AND space_key=$2 FOR UPDATE', [venueId, typeof target === 'number' ? target : `room-${target}`]);
    if (typeof target === 'number' && !old.length) { await client.query('ROLLBACK'); return null; }
    if (typeof target === 'string' && old.length) { await client.query('COMMIT'); return old[0].id; }
    const values = [details.name,details.eyebrow,details.description,`Up to ${details.maxGuests} people`,details.maxGuests,details.photos[0],details.photos,details.communityRate,details.productionRate];
    const { rows } = old.length
      ? await client.query(`UPDATE venue_spaces SET name=$3,eyebrow=$4,description=$5,capacity=$6,max_guests=$7,image=$8,photos=$9,community_rate=$10,production_rate=$11,updated_at=now() WHERE venue_id=$1 AND id=$2 RETURNING id`, [venueId,target,...values])
      : await client.query(`INSERT INTO venue_spaces(venue_id,space_key,name,eyebrow,description,capacity,max_guests,image,photos,community_rate,production_rate,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,(SELECT COALESCE(max(sort_order),0)+1 FROM venue_spaces WHERE venue_id=$1)) RETURNING id`, [venueId,`room-${target}`,...values]);
    await client.query('INSERT INTO venue_host_changes(venue_slug,actor_name,field,before_value,after_value) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',
      [slug,actor,`${details.name} ${old.length ? 'space updated' : 'space added'}`,JSON.stringify(old[0] ?? null),JSON.stringify(details)]);
    await client.query('COMMIT');
    return rows[0].id;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
