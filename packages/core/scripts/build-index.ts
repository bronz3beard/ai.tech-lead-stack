#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const TARGET_DIR = process.cwd();
const INDEX_DIR = path.join(TARGET_DIR, '.tls-index');
const INDEX_FILE = path.join(INDEX_DIR, 'index.json');
const REPO_MAP_FILE = path.join(INDEX_DIR, 'repo_map.json');

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.git', '.tls-index', 'coverage', '.cache']);
const VALID_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.md', '.py', '.go', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
  '.kt', '.rs', '.css', '.html', '.json', '.yml', '.yaml'
]);

const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/embeddings';
const CHUNK_MAX_LINES = 60;

interface Chunk {
  path: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  text: string;
  embedding: number[];
}

interface IndexData {
  files: Record<string, { mtime: number; hash: string }>;
  chunks: Chunk[];
}

interface RepoMapSymbol {
  signature: string;
}

interface RepoMapFile {
  path: string;
  symbols: RepoMapSymbol[];
}

/**
 * Fetches the embedding vector for a given text from a local Ollama instance.
 * Fails gracefully by returning null if the service is unreachable.
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
        prompt: text
      })
    });
    if (!response.ok) {
      console.error(`[Index] Ollama embedding failed: ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error(`[Index] Ollama connection error:`, error);
    return null;
  }
}

/**
 * Recursively discovers files in a directory, applying global ignore rules 
 * and filtering by valid source code extensions.
 */
async function walkDir(dir: string, files: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath, files);
      } else if (entry.isFile() && VALID_EXTS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`[Index] Error reading dir ${dir}:`, error);
  }
  return files;
}

/**
 * Splits a file into smaller chunks for embedding.
 * Uses a regex heuristic to slice at major symbol boundaries (functions, classes) 
 * or falls back to a fixed line-count limit to prevent context window overflow.
 */
function chunkFile(content: string, filePath: string): Omit<Chunk, 'embedding' | 'path'>[] {
  const lines = content.split('\n');
  const chunks: Omit<Chunk, 'embedding' | 'path'>[] = [];
  
  // Basic heuristic fallback chunking
  let currentChunkLines: string[] = [];
  let startLine = 1;
  let currentSymbol: string | null = null;
  
  const flushChunk = (endLine: number) => {
    if (currentChunkLines.length > 0) {
      chunks.push({
        startLine,
        endLine,
        symbol: currentSymbol,
        text: currentChunkLines.join('\n')
      });
    }
  };

  const symbolRegex = /^(?:export\s+)?(?:const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_]+)/;
  const headerRegex = /^#+\s+(.*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    const symbolMatch = line.match(symbolRegex);
    const headerMatch = line.match(headerRegex);
    
    const match = symbolMatch?.[1] || headerMatch?.[1];
    
    if (match && currentChunkLines.length > 0) {
      flushChunk(lineNum - 1);
      currentChunkLines = [];
      startLine = lineNum;
      currentSymbol = match;
    }
    
    currentChunkLines.push(line);
    
    if (currentChunkLines.length >= CHUNK_MAX_LINES) {
      flushChunk(lineNum);
      currentChunkLines = [];
      startLine = lineNum + 1;
      // We don't reset currentSymbol as it might still be within the same symbol
    }
  }
  
  flushChunk(lines.length);
  return chunks;
}

/**
 * Extracts top-level declarations (functions, classes, const arrows) to populate 
 * the high-level repo map without storing full function bodies.
 */
function extractSignatures(content: string): string[] {
  const lines = content.split('\n');
  const signatures: string[] = [];
  
  // Extract simple signatures (functions, classes)
  const sigRegex = /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type)\s+([a-zA-Z0-9_<>\s]+)(?:\(.*?\))?(?:[^{]*)/;
  const constFuncRegex = /^(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\(.*?\)|[^=]*?)\s*=>/;
  
  for (const line of lines) {
    const sMatch = line.match(sigRegex);
    if (sMatch) signatures.push(line.trim().replace(/\s*{\s*$/, ''));
    
    const cMatch = line.match(constFuncRegex);
    if (cMatch) signatures.push(line.trim().replace(/\s*{\s*$/, ''));
  }
  return signatures;
}

async function loadIndex(): Promise<IndexData> {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { files: {}, chunks: [] };
  }
}

async function saveIndex(data: IndexData) {
  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(data), 'utf8');
}

async function saveRepoMap(map: RepoMapFile[]) {
  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(REPO_MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
}

function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Main orchestrator for building or incrementally updating the local index.
 * Identifies file changes via hashes and mtime to avoid re-embedding unmodified files.
 * Removes stale entries for deleted files and maintains the global repo map.
 */
async function run() {
  console.log(`[Index] Building local index in ${INDEX_DIR}...`);
  const files = await walkDir(TARGET_DIR);
  const index = await loadIndex();
  
  const newChunks: Chunk[] = [];
  const repoMap: RepoMapFile[] = [];
  
  let updatedCount = 0;
  
  // Create a map to retain valid old chunks
  const retainedChunks = new Map<string, Chunk[]>();
  
  for (const filePath of files) {
    const relPath = path.relative(TARGET_DIR, filePath);
    try {
      const stats = await fs.stat(filePath);
      const mtime = stats.mtimeMs;
      
      const content = await fs.readFile(filePath, 'utf8');
      const hash = hashString(content);
      
      const fileInfo = index.files[relPath];
      
      const signatures = extractSignatures(content);
      if (signatures.length > 0) {
        repoMap.push({
          path: relPath,
          symbols: signatures.map(s => ({ signature: s }))
        });
      }

      if (fileInfo && fileInfo.hash === hash) {
        // Unchanged
        retainedChunks.set(relPath, index.chunks.filter(c => c.path === relPath));
        continue;
      }
      
      console.log(`[Index] Indexing ${relPath}`);
      updatedCount++;
      
      const parsedChunks = chunkFile(content, relPath);
      
      // Batch embedding calls or do sequentially? Sequentially is safer for local Ollama
      for (const chunk of parsedChunks) {
        const embedding = await getEmbedding(chunk.text);
        if (embedding) {
          newChunks.push({
            ...chunk,
            path: relPath,
            embedding
          });
        }
      }
      
      index.files[relPath] = { mtime, hash };
    } catch (e) {
      console.error(`[Index] Failed to process ${relPath}`, e);
    }
  }
  
  // Rebuild chunk list with valid retained chunks and newly embedded ones
  const validOldChunks = Array.from(retainedChunks.values()).flat();
  index.chunks = [...validOldChunks, ...newChunks];
  
  // Purge files that were deleted from the filesystem
  const currentRelPaths = new Set(files.map(f => path.relative(TARGET_DIR, f)));
  for (const relPath of Object.keys(index.files)) {
    if (!currentRelPaths.has(relPath)) {
      delete index.files[relPath];
      index.chunks = index.chunks.filter(c => c.path !== relPath);
    }
  }
  
  await saveIndex(index);
  
  // Rank repo map (simple for now: alphabetically)
  repoMap.sort((a, b) => a.path.localeCompare(b.path));
  await saveRepoMap(repoMap);
  
  console.log(`[Index] Done. Updated ${updatedCount} files. Total files indexed: ${Object.keys(index.files).length}. Total chunks: ${index.chunks.length}.`);
}

run().catch(e => {
  console.error('[Index] Fatal error', e);
  process.exit(1);
});
