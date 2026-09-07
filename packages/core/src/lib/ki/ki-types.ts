/**
 * @desc Metadata for an Antigravity Knowledge Item
 */
export interface KiMetadata {
  /** Short, descriptive summary of the knowledge item */
  summary: string;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last modified */
  updatedAt: string;
  /** List of source conversation IDs or URLs */
  references?: string[];
  /** Optional project name for scoping */
  projectName?: string;
  /** Optional tags for classification */
  tags?: string[];
  /** Optional approval state */
  approval?: {
    status: 'draft' | 'human-approved' | 'rejected';
    timestamp?: string;
    by?: string;
  };
}

/**
 * @desc Structure of a Knowledge Item as stored on disk
 */
export interface KnowledgeItem {
  /** Unique slug (folder name) */
  slug: string;
  /** Parsed metadata.json */
  metadata: KiMetadata;
  /** List of artifact files in the /artifacts folder */
  artifacts: {
    name: string;
    content: string;
  }[];
}

/**
 * @desc Input for creating/updating a Knowledge Item
 */
export interface UpsertKiInput {
  slug: string;
  summary: string;
  projectName?: string;
  references?: string[];
  artifacts: {
    name: string;
    content: string;
  }[];
  tags?: string[];
  approval?: {
    status: 'draft' | 'human-approved' | 'rejected';
    timestamp?: string;
    by?: string;
  };
}
