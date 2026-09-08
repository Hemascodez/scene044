import { NextRequest, NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    if (!(await checkCuratorAccess(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ") || authHeader.length <= "Bearer ".length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);

    // 1. Fetch subscribers from DB
    const { rows } = await query(
      `SELECT phone_e164 AS phone, name, role, categories, message,
              consent_note, status, created_at
         FROM subscribers
        WHERE channel = 'whatsapp'
        ORDER BY created_at ASC`,
    );

    // 2. Create a new Google Sheet
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: `SCENE/044 Subscribers (${new Date().toLocaleDateString()})`,
        },
      }),
    });

    if (!createRes.ok) {
      return NextResponse.json({ error: "Failed to create spreadsheet" }, { status: 500 });
    }

    const sheetData = await createRes.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl;

    // 3. Prepare data for the sheet
    const values = [
      [
        "Phone Number",
        "Name",
        "Role",
        "Categories",
        "Message",
        "Consent Note",
        "Status",
        "Subscribed At",
      ],
      ...rows.map((row) => [
        row.phone || "N/A",
        row.name || "",
        row.role || "",
        Array.isArray(row.categories) ? row.categories.join(", ") : row.categories || "",
        row.message || "",
        row.consent_note || "",
        row.status || "",
        row.created_at ? new Date(row.created_at).toISOString() : "",
      ]),
    ];

    // 4. Write data to the newly created sheet
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: values,
        }),
      },
    );

    if (!updateRes.ok) {
      return NextResponse.json({ error: "Failed to write to spreadsheet" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, spreadsheetUrl });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected sync failure" },
      { status: 500 },
    );
  }
}
