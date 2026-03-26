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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enhanced fetch with retry logic for 429 Too Many Requests.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        if (i === maxRetries) return response;
        
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Langfuse 429 Rate Limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries) throw error;
      await sleep(initialDelay * Math.pow(2, i));
    }
  }
  
  throw lastError || new Error('Unknown fetch error');
}

/**
 * Fetches all pages from a Langfuse API endpoint that supports pagination.
 *
 * @param baseUrl The base URL of the Langfuse API (e.g. https://cloud.langfuse.com)
 * @param endpoint The endpoint to fetch from (e.g. /api/public/traces)
 * @param queryParams Any query parameters to append to the URL (e.g. userId=foo)
 * @param authHeader The Authorization header to use
 * @param totalLimit Optional limit on the total number of items to fetch
 * @returns An array containing all items from all pages
 */
export async function fetchAllPages<T>(
  baseUrl: string,
  endpoint: string,
  queryParams: URLSearchParams,
  authHeader: string,
  totalLimit?: number
): Promise<T[]> {
  const allData: T[] = [];
  let currentPage = 1;
  const batchSize = 100;

  while (true) {
    // Clone params to avoid mutating the original
    const params = new URLSearchParams(queryParams.toString());
    params.set('page', currentPage.toString());
    
    // Calculate how many items to fetch in this batch
    let currentBatchLimit = batchSize;
    if (totalLimit) {
      currentBatchLimit = Math.min(batchSize, totalLimit - allData.length);
      if (currentBatchLimit <= 0) break;
    }
    params.set('limit', currentBatchLimit.toString());

    const url = `${baseUrl}${endpoint}?${params.toString()}`;

    const response = await fetchWithRetry(url, {
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
      if (json.data.length === 0) {
        break;
      }
      allData.push(...json.data);
      
      // Check if we hit the total limit
      if (totalLimit && allData.length >= totalLimit) {
        break;
      }
    } else {
      break;
    }

    if (!json.meta || json.meta.page >= json.meta.totalPages) {
      break;
    }

    currentPage++;
    
    // Add a small 100ms delay between pages to be gentle with Langfuse
    await sleep(100);
  }

  return totalLimit ? allData.slice(0, totalLimit) : allData;
}
