import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeEventCity } from "@/lib/eventLocations";

export async function GET(request: Request) {
  if (!(await checkCuratorAccess(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { rows } = await query<{ city: string }>("SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND trim(city) <> '' ORDER BY city");
    const cities = [...new Set(rows.map(row => normalizeEventCity(row.city)).filter((city): city is string => !!city))]
      .sort((a, b) => a.localeCompare(b, "en-IN"));
    return NextResponse.json({ cities }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "City suggestions are temporarily unavailable. You can still type a city." }, { status: 503 });
  }
}
