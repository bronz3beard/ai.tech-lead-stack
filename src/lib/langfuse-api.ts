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
      
      // If we hit a 429, retry with exponential backoff + jitter
      if (response.status === 429) {
        if (i === maxRetries) return response; // Final attempt, return the 429 for the caller to handle
        
        // Exponential backoff with small random jitter
        const jitter = Math.random() * 500;
        const delay = (initialDelay * Math.pow(2, i)) + jitter;
        
        console.warn(`Langfuse 429 Rate Limit hit. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
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
    const params = new URLSearchParams(queryParams.toString());
    params.set('page', currentPage.toString());
    
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

    // Special Case: 429 Rate Limit exceeded after all retries
    if (response.status === 429) {
      console.error(`Langfuse Hard Rate Limit Reached for ${endpoint}. Returning partial data (${allData.length} items).`);
      return allData; // Return whatever we found so far instead of crashing the UI
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Langfuse API Error: ${response.status} for ${endpoint}. returning partial data.`);
      return allData; // Be resilient: return partial data instead of crashing
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
    
    // Add a 250ms delay between pages to be gentle with Langfuse
    await sleep(250);
  }

  return totalLimit ? allData.slice(0, totalLimit) : allData;
}
