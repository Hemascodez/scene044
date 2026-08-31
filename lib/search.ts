/** Thrown when search credentials are absent, so callers can report a setup
 *  problem instead of retrying every query and logging 11 identical 403s. */
export class MissingSearchCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingSearchCredentialsError";
  }
}

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

interface GoogleCseItem {
  title: string;
  snippet?: string;
  link: string;
}

interface GoogleCseResponse {
  items?: GoogleCseItem[];
}

export async function runSearchQuery(
  queryText: string,
  siteFilter?: string | null,
): Promise<SearchResult[]> {
  // Checked before building the URL: interpolating a blank key produces
  // `key=`, and Google answers with an opaque 403 "unregistered callers"
  // that reads like a permissions problem rather than a missing setting.
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) {
    throw new MissingSearchCredentialsError(
      `Google Custom Search is not configured: ${[
        !apiKey && "GOOGLE_CSE_API_KEY",
        !cx && "GOOGLE_CSE_CX",
      ]
        .filter(Boolean)
        .join(" and ")} is empty. Discovery cannot run without it.`,
    );
  }

  const q = siteFilter ? `${queryText} ${siteFilter}` : queryText;

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&num=10`;

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Google CSE request failed with status ${response.status}: ${body}`,
    );
  }

  const data = (await response.json()) as GoogleCseResponse;

  if (!data.items) {
    return [];
  }

  return data.items.map((item) => ({
    title: item.title,
    snippet: item.snippet ?? "",
    link: item.link,
  }));
}
