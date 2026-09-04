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
        text = text.slice(0, budget * 4) + '\n... (truncated due to token budget)';
      }

      return {
        content: [{ type: 'text', text }],
        isError: false,
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: 'text', text: `Failed to load repo map: ${e.message}` }] };
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

      const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/embeddings';
      const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';

      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: query })
      });
      if (!response.ok) throw new Error('Failed to get query embedding');
      const { embedding: queryEmbedding } = await response.json();

      const targetDir = process.cwd();
      const indexPath = path.join(targetDir, '.tls-index', 'index.json');
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);

      // Cosine similarity
      const similarity = (a: number[], b: number[]) => {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
      };

      const results = index.chunks.map((chunk: any) => ({
        ...chunk,
        score: chunk.embedding ? similarity(queryEmbedding, chunk.embedding) : -1
      })).sort((a: any, b: any) => b.score - a.score).slice(0, k);

      const text = results.map((r: any) => 
        `File: ${r.path} (Lines ${r.startLine}-${r.endLine})\nScore: ${r.score.toFixed(3)}\n${r.text}`
      ).join('\n\n---\n\n');

      return {
        content: [{ type: 'text', text: text || 'No results found.' }],
        isError: false,
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: 'text', text: `Code search failed: ${e.message}` }] };
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
      if (!filePath || !startLine || !endLine) throw new Error('path, startLine, and endLine are required');

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
      return { isError: true, content: [{ type: 'text', text: `Failed to read region: ${e.message}` }] };
    }
  }
}
