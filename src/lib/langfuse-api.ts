/**
 * Utility for fetching paginated data from Langfuse API.
 */

export interface LangfuseMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface LangfusePaginatedResponse<T> {
  data: T[];
  meta: LangfuseMeta;
}

/**
 * Fetches all pages from a Langfuse API endpoint that supports pagination.
 *
 * @param baseUrl The base URL of the Langfuse API (e.g. https://cloud.langfuse.com)
 * @param endpoint The endpoint to fetch from (e.g. /api/public/traces)
 * @param queryParams Any query parameters to append to the URL (e.g. userId=foo)
 * @param authHeader The Authorization header to use
 * @returns An array containing all items from all pages
 */
export async function fetchAllPages<T>(
  baseUrl: string,
  endpoint: string,
  queryParams: URLSearchParams,
  authHeader: string
): Promise<T[]> {
  const allData: T[] = [];
  let currentPage = 1;
  const limit = 100;

  while (true) {
    // Clone params to avoid mutating the original
    const params = new URLSearchParams(queryParams.toString());
    params.set('page', currentPage.toString());
    params.set('limit', limit.toString());

    const url = `${baseUrl}${endpoint}?${params.toString()}`;

    // console.log(`Fetching Langfuse page ${currentPage}: ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch from Langfuse: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const json = (await response.json()) as LangfusePaginatedResponse<T>;

    if (json.data && Array.isArray(json.data)) {
      allData.push(...json.data);
    }

    if (!json.meta || json.meta.page >= json.meta.totalPages) {
      break;
    }

    currentPage++;
  }

  return allData;
}
