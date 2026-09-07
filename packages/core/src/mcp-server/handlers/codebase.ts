import * as fs from 'fs/promises';
import * as path from 'path';

export class CodebaseHandlers {
  /**
   * Serves a high-level structural map of the repository (exported symbols per file).
   * Intended as the first step in codebase discovery, allowing agents to navigate
   * architecture without reading full file contents. Enforces a soft token budget
   * to protect context windows.
   */
  async handleRepoMap(args: Record<string, any>) {
    try {
      const budget = args.tokenBudget || 100000;
      const targetDir = process.cwd();
      const mapPath = path.join(targetDir, '.tls-index', 'repo_map.json');
      const data = await fs.readFile(mapPath, 'utf8');
      const map = JSON.parse(data);

      let text = 'Repo Map:\n';
      for (const file of map) {
        text += `${file.path}:\n`;
        for (const sym of file.symbols) {
          text += `  ${sym.signature}\n`;
        }
      }

      // Very rough token approximation (4 chars = 1 token)
      if (text.length / 4 > budget) {
        text =
          text.slice(0, budget * 4) + '\n... (truncated due to token budget)';
      }

      return {
        content: [{ type: 'text', text }],
        isError: false,
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `Failed to load repo map: ${e.message}` },
        ],
      };
    }
  }

  /**
   * Performs semantic similarity search against the local codebase index.
   * Enables agents to find relevant implementation details via natural language
   * or symbol queries without brute-force grepping. Relies on local Ollama
   * embeddings generated during the build-index phase.
   */
  async handleCodeSearch(args: Record<string, any>) {
    try {
      const query = args.query;
      const k = args.k || 5;
      if (!query) throw new Error('Query is required');

      const OLLAMA_URL =
        process.env.OLLAMA_URL || 'http://localhost:11434/api/embeddings';
      const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';

      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: query }),
      });
      if (!response.ok) throw new Error('Failed to get query embedding');
      const { embedding: queryEmbedding } = await response.json();

      const targetDir = process.cwd();
      const indexPath = path.join(targetDir, '.tls-index', 'index.json');
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);

      // Cosine similarity
      const similarity = (a: number[], b: number[]) => {
        let dot = 0,
          normA = 0,
          normB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
      };

      const results = index.chunks
        .map((chunk: any) => ({
          ...chunk,
          score: chunk.embedding
            ? similarity(queryEmbedding, chunk.embedding)
            : -1,
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, k);

      const text = results
        .map(
          (r: any) =>
            `File: ${r.path} (Lines ${r.startLine}-${r.endLine})\nScore: ${r.score.toFixed(3)}\n${r.text}`
        )
        .join('\n\n---\n\n');

      return {
        content: [{ type: 'text', text: text || 'No results found.' }],
        isError: false,
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Code search failed: ${e.message}` }],
      };
    }
  }

  /**
   * Fetches a precise slice of code from a specific file.
   * Used as a follow-up to code_search to expand context around a matched chunk,
   * completely replacing the need for agents to 'cat' entire files.
   */
  async handleReadRegion(args: Record<string, any>) {
    try {
      const { path: filePath, startLine, endLine } = args;
      if (!filePath || !startLine || !endLine)
        throw new Error('path, startLine, and endLine are required');

      const fullPath = path.resolve(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      const lines = content.split('\n');

      const slice = lines.slice(startLine - 1, endLine).join('\n');
      const text = `File: ${filePath} (Lines ${startLine}-${endLine})\n\n${slice}`;

      return {
        content: [{ type: 'text', text }],
        isError: false,
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `Failed to read region: ${e.message}` },
        ],
      };
    }
  }

  /**
   * Modifies a file by looking for specific sections of text and replacing them with new text.
   * This is much faster and cheaper for the AI because it doesn't have to rewrite the entire file.
   * Note:: This is handled by the agent under the hood;
   * To use this, you provide instructions in this format:
   * <<<<<<< SEARCH
   * [the exact lines of code that currently exist in the file]
   * =======
   * [the new lines of code you want to put in their place]
   * >>>>>>> REPLACE
   *
   * Before making any changes, this function checks to make sure you aren't trying to edit
   * sensitive files (like authentication or infrastructure files). If you are, it will stop
   * and require a human to manually approve the changes.
   *
   * @param args - The information needed to make the change. It must include the "path" (which file to edit) and the "patch" (the search and replace instructions).
   * @returns The result of the operation, telling the system if it succeeded or explaining what went wrong.
   */
  async handleApplyPatch(args: Record<string, any>) {
    try {
      const { path: filePath, patch } = args;
      if (!filePath || !patch) throw new Error('path and patch are required');

      const targetDir = process.cwd();
      const fullPath = path.resolve(targetDir, filePath);
      const relativePath = path.relative(targetDir, fullPath);

      // 1. Guard check for protected paths
      const hooksDir = path.join(targetDir, '.ai', 'hooks');
      let protectedGuards: any[] = [];
      try {
        const files = await fs.readdir(hooksDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(
              path.join(hooksDir, file),
              'utf-8'
            );
            const guard = JSON.parse(content);
            if (guard.condition?.diffContains) {
              protectedGuards.push(guard);
            }
          }
        }
      } catch (e) {
        // ignore if hooks dir doesn't exist
      }

      const matchGlob = (pattern: string, testPath: string) => {
        // basic minimatch-like conversion for ** and *
        const escaped = pattern.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
        const regexStr = escaped
          .replace(/\\\*\\\*/g, '.*')
          .replace(/(?<!\.)\\\*/g, '[^/]*');
        return new RegExp(`^${regexStr}$`).test(testPath);
      };

      for (const guard of protectedGuards) {
        for (const pattern of guard.condition.diffContains) {
          if (matchGlob(pattern, relativePath)) {
            if (
              guard.action === 'require-human-approve' ||
              guard.action === 'block'
            ) {
              return {
                isError: false,
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        refused: true,
                        reason: guard.message,
                        escalateTo: 'human',
                        guardId: guard.id,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }
          }
        }
      }

      // 2. Read existing file or handle new file
      let content = '';
      let exists = false;
      try {
        content = await fs.readFile(fullPath, 'utf8');
        exists = true;
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
      }

      // 3. Parse and apply patch blocks
      const blockRegex =
        /<<<<<<< SEARCH\r?\n([\s\S]*?)(?:\r?\n)?=======\r?\n([\s\S]*?)(?:\r?\n)?>>>>>>> REPLACE/g;
      let match;
      let newContent = content;
      let matches = 0;

      while ((match = blockRegex.exec(patch)) !== null) {
        matches++;
        let search = match[1];
        const replace = match[2];

        if (!exists && search === '') {
          newContent = replace + (replace ? '\n' : '');
          continue;
        }

        // Exact match check
        let exactMatches = newContent.split(search).length - 1;

        // Fallback for newline mismatch just in case
        if (exactMatches !== 1) {
          const searchLF = search.replace(/\r\n/g, '\n');
          exactMatches = newContent.split(searchLF).length - 1;
          if (exactMatches === 1) {
            search = searchLF;
          }
        }

        if (exactMatches !== 1) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'PatchFailed',
                  message: `SEARCH block matched ${exactMatches} times. It must match exactly once.`,
                  block: search,
                }),
              },
            ],
          };
        }

        newContent = newContent.replace(search, replace);
      }

      if (matches === 0) {
        return {
          isError: true,
          content: [
            { type: 'text', text: 'No SEARCH/REPLACE blocks found in patch.' },
          ],
        };
      }

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, newContent, 'utf8');

      return {
        content: [
          { type: 'text', text: `Successfully applied patch to ${filePath}` },
        ],
        isError: false,
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `Failed to apply patch: ${e.message}` },
        ],
      };
    }
  }
}
