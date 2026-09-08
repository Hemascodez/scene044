import { JWT } from "google-auth-library";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const HEADERS = [
  "Phone Number",
  "Name",
  "Role",
  "Categories",
  "Message",
  "Consent Note",
  "Status",
  "Subscribed At",
] as const;

export interface WhatsappSheetSubscriber {
  phone: string;
  name: string | null;
  role: string | null;
  categories: string[];
  message: string | null;
  consentNote: string | null;
  status: string;
  subscribedAt: Date | string;
}

interface SheetsConfig {
  spreadsheetId: string;
  tabName: string;
  serviceAccountEmail: string;
  privateKey: string;
}

function getSheetsConfig(): SheetsConfig | null {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const serviceAccountEmail = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawPrivateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim();

  if (!spreadsheetId && !serviceAccountEmail && !rawPrivateKey) return null;
  if (!spreadsheetId || !serviceAccountEmail || !rawPrivateKey) {
    throw new Error(
      "Google Sheets sync is partially configured. Set GOOGLE_SHEETS_SPREADSHEET_ID, " +
        "GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SHEETS_PRIVATE_KEY together.",
    );
  }

  return {
    spreadsheetId,
    tabName: process.env.GOOGLE_SHEETS_TAB_NAME?.trim() || "Sheet1",
    serviceAccountEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
  };
}

function a1Range(tabName: string, cells: string): string {
  return `'${tabName.replace(/'/g, "''")}'!${cells}`;
}

async function sheetsRequest<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Google Sheets API returned ${response.status}: ${detail}`);
  }

  return (await response.json()) as T;
}

function valuesUrl(spreadsheetId: string, range: string): string {
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}/values/${encodeURIComponent(range)}`;
}

/**
 * Upserts one WhatsApp subscriber into the configured sheet, keyed by phone
 * number. Replayed Meta webhooks and later messages update the existing row
 * instead of producing duplicates.
 *
 * Returns false when automatic Sheets sync is intentionally not configured.
 */
export async function upsertWhatsappSubscriberInGoogleSheet(
  subscriber: WhatsappSheetSubscriber,
): Promise<boolean> {
  const config = getSheetsConfig();
  if (!config) return false;

  const auth = new JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: [SHEETS_SCOPE],
  });
  const credentials = await auth.authorize();
  const accessToken = credentials.access_token;
  if (!accessToken) throw new Error("Google service account did not return an access token.");

  const headerRange = a1Range(config.tabName, `A1:H1`);
  const headerData = await sheetsRequest<{ values?: unknown[][] }>(
    accessToken,
    valuesUrl(config.spreadsheetId, headerRange),
  );
  const currentHeader = headerData.values?.[0];

  if (!currentHeader?.length) {
    await sheetsRequest(
      accessToken,
      `${valuesUrl(config.spreadsheetId, headerRange)}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [HEADERS] }),
      },
    );
  } else if (JSON.stringify(currentHeader) !== JSON.stringify(HEADERS)) {
    throw new Error(
      `Google Sheets tab "${config.tabName}" has unexpected headers. Use a blank tab or the documented columns.`,
    );
  }

  const dataRange = a1Range(config.tabName, "A2:H");
  const existing = await sheetsRequest<{ values?: unknown[][] }>(
    accessToken,
    valuesUrl(config.spreadsheetId, dataRange),
  );
  const existingIndex = (existing.values ?? []).findIndex(
    (row) => String(row[0] ?? "") === subscriber.phone,
  );

  const values = [[
    subscriber.phone,
    subscriber.name ?? "",
    subscriber.role ?? "",
    subscriber.categories.join(", "),
    subscriber.message ?? "",
    subscriber.consentNote ?? "",
    subscriber.status,
    new Date(subscriber.subscribedAt).toISOString(),
  ]];

  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    const rowRange = a1Range(config.tabName, `A${rowNumber}:H${rowNumber}`);
    await sheetsRequest(
      accessToken,
      `${valuesUrl(config.spreadsheetId, rowRange)}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
  } else {
    await sheetsRequest(
      accessToken,
      `${valuesUrl(config.spreadsheetId, dataRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values }) },
    );
  }

  return true;
}
