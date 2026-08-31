import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Serves a stored poster. Public by design — these appear on the public feed.
 *
 * The Content-Type comes from the magic-byte detection done at upload time,
 * never from anything the uploader supplied, and `nosniff` stops a browser
 * second-guessing it. Between those two, a stored file can only ever be
 * interpreted as the raster image it was verified to be.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const posterId = Number(id);
  if (!Number.isInteger(posterId) || posterId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    const { rows } = await query<{ mime: string; bytes: Buffer }>(
      "SELECT mime, bytes FROM poster_uploads WHERE id = $1",
      [posterId],
    );
    const poster = rows[0];
    if (!poster) return NextResponse.json({ error: "not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(poster.bytes), {
      status: 200,
      headers: {
        "Content-Type": poster.mime,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        // Immutable: a poster_uploads row is never mutated, only superseded by
        // a new row with a new id, so the URL can be cached indefinitely.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}
