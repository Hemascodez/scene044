import { pool } from '@/lib/db';
import { getVenueUserFromRequest } from '@/lib/venueUserAuth';

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
      else await client.query('UPDATE venue_spaces SET image=$3,updated_at=now() WHERE id=$2 AND venue_id=(SELECT id FROM venues WHERE slug=$1)', [slug, roomId, value]);
      await client.query('INSERT INTO venue_host_changes(venue_slug,actor_name,field,before_value,after_value) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',
        [slug, actor, roomId === undefined ? 'Venue gallery / cover' : `${rows[0].name} photo`, JSON.stringify(before), JSON.stringify(value)]);
    }
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
