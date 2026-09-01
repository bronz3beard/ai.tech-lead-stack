import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { KiMetadata, KnowledgeItem, UpsertKiInput } from './ki-types';

/**
 * @desc KiService handles all operations for Antigravity Knowledge Items.
 * Source of truth is ~/.gemini/antigravity/knowledge/
 */
export class KiService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.gemini', 'antigravity', 'knowledge');
  }

  /**
   * @desc Ensures the base directory exists
   */
  private async ensureBaseDir() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create KI base directory:', error);
    }
  }

  /**
   * @desc Lists all knowledge items, optionally filtered by project
   */
  async listKnowledgeItems(projectName?: string): Promise<{ slug: string; summary: string; projectName?: string }[]> {
    await this.ensureBaseDir();
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const slugs = entries.filter(e => e.isDirectory()).map(e => e.name);
      
      const results: { slug: string; summary: string; projectName?: string }[] = [];
      
      for (const slug of slugs) {
        try {
          const metadataPath = path.join(this.baseDir, slug, 'metadata.json');
          const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
          const metadata: KiMetadata = JSON.parse(metadataRaw);
          
          if (projectName && metadata.projectName !== projectName) {
            continue;
          }
          
          results.push({
            slug,
            summary: metadata.summary,
            projectName: metadata.projectName
          });
        } catch {
          // Skip malformed KIs
          continue;
        }
      }
      
      return results;
    } catch (error) {
      console.error('Failed to list knowledge items:', error);
      return [];
    }
  }

  /**
   * @desc Reads a single knowledge item
   */
  async readKnowledgeItem(slug: string): Promise<KnowledgeItem | null> {
    const kiPath = path.join(this.baseDir, slug);
    const metadataPath = path.join(kiPath, 'metadata.json');
    const artifactsDir = path.join(kiPath, 'artifacts');
    
    try {
      const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      const metadata: KiMetadata = JSON.parse(metadataRaw);
      
      const artifactFiles = await fs.readdir(artifactsDir);
      const artifacts: { name: string; content: string }[] = [];
      
      for (const file of artifactFiles) {
        const content = await fs.readFile(path.join(artifactsDir, file), 'utf-8');
        artifacts.push({ name: file, content });
      }
      
      return {
        slug,
        metadata,
        artifacts
      };
    } catch (error) {
      console.error(`Failed to read knowledge item ${slug}:`, error);
      return null;
    }
  }

  /**
   * @desc Creates or updates a knowledge item
   */
  async upsertKnowledgeItem(input: UpsertKiInput): Promise<KnowledgeItem> {
    await this.ensureBaseDir();
    const kiPath = path.join(this.baseDir, input.slug);
    const artifactsDir = path.join(kiPath, 'artifacts');
    
    await fs.mkdir(artifactsDir, { recursive: true });
    
    // Check for existing metadata to preserve createdAt
    let createdAt = new Date().toISOString();
    try {
      const existingRaw = await fs.readFile(path.join(kiPath, 'metadata.json'), 'utf-8');
      const existing: KiMetadata = JSON.parse(existingRaw);
      createdAt = existing.createdAt;
    } catch {
      // New item
    }
    
    const metadata: KiMetadata = {
      summary: input.summary,
      createdAt,
      updatedAt: new Date().toISOString(),
      projectName: input.projectName,
      references: input.references,
      tags: input.tags
    };
    
    // Write metadata
    await fs.writeFile(path.join(kiPath, 'metadata.json'), JSON.stringify(metadata, null, 2));
    
    // Write artifacts
    for (const artifact of input.artifacts) {
      await fs.writeFile(path.join(artifactsDir, artifact.name), artifact.content);
    }
    
    return {
      slug: input.slug,
      metadata,
      artifacts: input.artifacts
    };
  }

  /**
   * @desc Deletes a knowledge item
   */
  async deleteKnowledgeItem(slug: string): Promise<boolean> {
    const kiPath = path.join(this.baseDir, slug);
    try {
      await fs.rm(kiPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete knowledge item ${slug}:`, error);
      return false;
    }
  }
}
