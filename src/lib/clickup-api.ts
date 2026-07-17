/**
 * @desc Server-side utility for interacting with the ClickUp REST API.
 *       Standardizes authentication and error handling for ClickUp requests.
 */

export interface ClickUpTask {
  id: string;
  name: string;
  status: string;
  url: string;
  description: string;
  textContent: string;
  assignees: string[];
  acceptanceCriteria?: string;
}

export class ClickUpService {
  private baseUrl = 'https://api.clickup.com/api/v2';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': this.token,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ err: 'Unknown ClickUp API error' }));
      throw new Error(`ClickUp API Error: ${error.err || error.error || res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * @desc Parses a ClickUp task ID from a full URL or a bare ID string.
   * @param input - The URL or bare ID string.
   */
  static parseTaskId(input: string): string {
    const trimmed = input.trim();
    try {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const tIndex = pathParts.indexOf('t');
      if (tIndex !== -1 && tIndex + 1 < pathParts.length) {
        // e.g., /t/workspaceId/taskId or /t/taskId
        if (tIndex + 2 < pathParts.length) {
          return pathParts[tIndex + 2];
        }
        return pathParts[tIndex + 1];
      }
    } catch {
      // Not a valid URL, fallback to treating it as a bare ID
    }
    // Remove a leading hash if the user provided `#taskId`
    return trimmed.replace(/^#/, '');
  }

  /**
   * @desc Fetches a ClickUp task and returns a distilled representation.
   * @param taskId - The unique identifier for the ClickUp task.
   */
  async getTask(taskId: string): Promise<ClickUpTask> {
    const raw = await this.request<any>(`/task/${taskId}`);

    const assignees = Array.isArray(raw.assignees)
      ? raw.assignees.map((a: any) => a.username || a.email || 'Unknown')
      : [];

    const status = raw.status?.status || 'Unknown';
    const description = raw.description || '';
    const textContent = raw.text_content || '';

    // Attempt to extract acceptance criteria
    let acceptanceCriteria: string | undefined;

    // 1. Check custom fields
    if (Array.isArray(raw.custom_fields)) {
      const acField = raw.custom_fields.find((f: any) =>
        f.name && f.name.toLowerCase().includes('acceptance criteria')
      );
      if (acField && acField.value) {
        acceptanceCriteria = typeof acField.value === 'string'
          ? acField.value
          : JSON.stringify(acField.value);
      }
    }

    // 2. Check text content for a common markdown/text pattern
    if (!acceptanceCriteria && textContent) {
      const acMatch = textContent.match(/Acceptance Criteria:?\s*([\s\S]*?)(?:\n\n[A-Z]|$)/i);
      if (acMatch && acMatch[1]) {
        acceptanceCriteria = acMatch[1].trim();
      }
    }

    return {
      id: raw.id,
      name: raw.name || 'Untitled Task',
      status,
      url: raw.url || '',
      description,
      textContent,
      assignees,
      acceptanceCriteria,
    };
  }
}
