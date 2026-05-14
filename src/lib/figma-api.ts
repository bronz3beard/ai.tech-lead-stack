/**
 * @desc Server-side utility for interacting with the Figma REST API.
 *       Standardizes authentication and error handling for Figma requests.
 */

interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: any;
}

interface FigmaComment {
  id: string;
  file_key: string;
  message: string;
  user: {
    handle: string;
    img_url: string;
  };
  created_at: string;
}

export class FigmaService {
  private baseUrl = 'https://api.figma.com/v1';
  private pat: string;

  constructor(pat: string) {
    this.pat = pat;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.pat}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Unknown Figma API error' }));
      throw new Error(`Figma API Error: ${error.message || res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * @desc Fetches metadata for a specific Figma file.
   * @param fileKey - The unique identifier for the Figma file.
   */
  async getFile(fileKey: string): Promise<FigmaFile> {
    return this.request<FigmaFile>(`/files/${fileKey}`);
  }

  /**
   * @desc Fetches all comments on a Figma file.
   * @param fileKey - The unique identifier for the Figma file.
   */
  async getComments(fileKey: string): Promise<{ comments: FigmaComment[] }> {
    return this.request<{ comments: FigmaComment[] }>(`/files/${fileKey}/comments`);
  }

  /**
   * @desc Posts a new comment to a Figma file.
   * @param fileKey - The unique identifier for the Figma file.
   * @param message - The comment text.
   */
  async postComment(fileKey: string, message: string): Promise<FigmaComment> {
    return this.request<FigmaComment>(`/files/${fileKey}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
