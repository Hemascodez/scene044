import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { MAX_POSTER_BYTES } from "@/lib/imageBytes";
import { importPosterFromUrl, storePosterBytes } from "@/lib/posterStore";

/**
 * Two ways to attach a poster when the pipeline couldn't find one:
 *   - multipart/form-data with a `file` — the curator uploads from disk.
 *   - JSON `{ url }` — the server downloads it (SSRF-guarded) and re-hosts it.
 *
 * Both paths end in the same verification: bytes are only stored if their magic
 * bytes say JPG/PNG/WebP.
 */
export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      // Proxy buffers at most 10 MB by default. Reject oversized photos before
      // parsing, otherwise it forwards a truncated multipart body and the user
      // sees the unhelpful "Failed to parse body as FormData" exception.
      if (Number(request.headers.get("content-length")) > MAX_POSTER_BYTES + 65_536) {
        return NextResponse.json({ error: "Photo is too large. Maximum is 5 MB." }, { status: 413 });
      }
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return NextResponse.json({ error: "Could not read this photo. Use a JPG, PNG or WebP image under 5 MB and retry." }, { status: 400 });
      }
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file was included." }, { status: 400 });
      }
      // Cheap pre-check on the declared size before buffering the whole body.
      if (file.size > MAX_POSTER_BYTES) {
        return NextResponse.json(
          { error: `Too large (${(file.size / 1_000_000).toFixed(1)} MB). Maximum is 5 MB.` },
          { status: 413 },
        );
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const result = await storePosterBytes(bytes, "upload", null);
      return result.ok
        ? NextResponse.json(result)
        : NextResponse.json({ error: result.error }, { status: 400 });
    }

    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Provide a file or an image URL." }, { status: 400 });
    }
    const result = await importPosterFromUrl(url, "import");
    return result.ok
      ? NextResponse.json(result)
      : NextResponse.json({ error: result.error }, { status: 400 });
  } catch (err) {
    console.error("Curator poster upload failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ error: "Photo upload failed. Please retry." }, { status: 503 });
  }
}
