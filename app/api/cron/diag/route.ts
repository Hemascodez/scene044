import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/auth";

/**
 * Reports what the RUNNING container sees, so a misconfigured deployment can be
 * diagnosed without shell access.
 *
 * Never returns a secret. For DATABASE_URL it reports only shape — length,
 * whether it parses, and the host/port/username, all of which are already
 * visible in the Supabase dashboard. The password is never read, echoed or
 * hashed. Behind the cron secret so it isn't a public fingerprint of the
 * infrastructure.
 */
export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.DATABASE_URL ?? "";
  const db: Record<string, unknown> = {
    set: url.length > 0,
    length: url.length,
    startsWith: url.slice(0, 13),
    containsHash: url.includes("#"),
    containsSquareBrackets: url.includes("[") || url.includes("]"),
  };

  if (url) {
    try {
      // Exactly how pg parses it — see lib/db.ts.
      const parsed = new URL(url, "postgres://base");
      db.parses = true;
      db.host = parsed.hostname;
      db.port = parsed.port;
      db.username = parsed.username;
      db.database = parsed.pathname.replace(/^\//, "");
      db.passwordLength = parsed.password.length;
    } catch (err) {
      db.parses = false;
      db.parseError = (err as Error).message;
    }
  }

  return NextResponse.json({
    ok: true,
    database: db,
    // NEXT_PUBLIC_* is inlined at build time, so this reveals whether the
    // variable existed when `next build` ran — not merely at runtime.
    whatsappNumberInlinedAtBuild: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
    otherKeysPresent: {
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      FIRECRAWL_API_KEY: Boolean(process.env.FIRECRAWL_API_KEY),
      CURATOR_PASSWORD: Boolean(process.env.CURATOR_PASSWORD),
      CRON_SECRET: Boolean(process.env.CRON_SECRET),
    },
    railway: {
      service: process.env.RAILWAY_SERVICE_NAME ?? null,
      environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
      commit: (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
      deploymentId: (process.env.RAILWAY_DEPLOYMENT_ID ?? "").slice(0, 8) || null,
    },
  });
}
