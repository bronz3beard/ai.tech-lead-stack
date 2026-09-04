import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  assertNoRepoWrites,
  makeFakeClientRepo,
  snapshotTree,
  spyOnFsWrites,
} from '../../../__tests__/helpers/readonly-harness';
import { Handlers } from '../../../mcp-server/handlers';
import { Telemetry } from '../../../mcp-server/telemetry';
import { AlignmentService } from '../../skills/alignment-service';
import { FileSystemService } from '../../skills/fs-service';
import { KiService } from '../ki-service';

// Mock langfuse to prevent ESM dynamic import issues in Jest

describe('KiService & create_knowledge_item Readonly Confinement', () => {
  const repoRoot = path.resolve(__dirname, '../../../../../..');
  let fakeHomeDir: string;
  let fakeClientRepo: { root: string; cleanup: () => void };
  let homeDirSpy: jest.SpyInstance;

  beforeEach(() => {
    fakeHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-home-'));
    homeDirSpy = jest.spyOn(os, 'homedir').mockReturnValue(fakeHomeDir);
    fakeClientRepo = makeFakeClientRepo();
  });

  afterEach(() => {
    homeDirSpy.mockRestore();
    fakeClientRepo.cleanup();
    try {
      fs.rmSync(fakeHomeDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('(a) writes land under <fakeHome>/.gemini/antigravity/knowledge and (b) fake clientRepo shows ZERO tree changes', async () => {
    const kiService = new KiService();
    const fsService = new FileSystemService(repoRoot, fakeClientRepo.root);
    const telemetry = new Telemetry();
    jest
      .spyOn(telemetry, 'withAnalytics')
      .mockImplementation(
        async <T>(
          _s: any,
          _p: any,
          _m: any,
          _a: any,
          _c: any,
          fn: () => Promise<T>
        ): Promise<T> => fn()
      );

    const alignmentService = new AlignmentService(repoRoot);
    const handlers = new Handlers(
      fsService,
      telemetry,
      alignmentService,
      kiService
    );

    const beforeTree = snapshotTree(fakeClientRepo.root);
    const { writes, restore } = spyOnFsWrites();

    try {
      // 1. Create KI via KiService
      const ki1 = await kiService.upsertKnowledgeItem({
        slug: 'direct-ki-1',
        summary: 'Direct KI Summary',
        artifacts: [{ name: 'doc.txt', content: 'Direct content' }],
      });
      expect(ki1.slug).toBe('direct-ki-1');

      // 2. Create KI via create_knowledge_item handler
      const toolRes = await handlers.handleCreateKnowledgeItem({
        slug: 'mcp-ki-2',
        summary: 'MCP Tool KI Summary',
        artifacts: [{ name: 'notes.md', content: 'MCP notes' }],
      });
      expect(toolRes.isError).toBe(false);
      expect(toolRes.content[0].text).toContain('mcp-ki-2');

      const expectedKiBase = path.join(
        fakeHomeDir,
        '.gemini',
        'antigravity',
        'knowledge'
      );

      // (a) Assert writes landed under <fakeHome>/.gemini/antigravity/knowledge
      expect(
        fs.existsSync(path.join(expectedKiBase, 'direct-ki-1', 'metadata.json'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(expectedKiBase, 'mcp-ki-2', 'metadata.json'))
      ).toBe(true);

      const afterTree = snapshotTree(fakeClientRepo.root);

      // (b) Assert fake clientRepo shows ZERO tree changes
      assertNoRepoWrites(beforeTree, afterTree, { allow: [] });

      // Assert no writes targeted clientRoot
      const clientWrites = writes.filter((w) =>
        w.path.startsWith(fakeClientRepo.root)
      );
      expect(clientWrites).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('(c) reads never write to disk', async () => {
    const kiService = new KiService();
    const fsService = new FileSystemService(repoRoot, fakeClientRepo.root);
    const telemetry = new Telemetry();
    jest
      .spyOn(telemetry, 'withAnalytics')
      .mockImplementation(
        async <T>(
          _s: any,
          _p: any,
          _m: any,
          _a: any,
          _c: any,
          fn: () => Promise<T>
        ): Promise<T> => fn()
      );

    const alignmentService = new AlignmentService(repoRoot);
    const handlers = new Handlers(
      fsService,
      telemetry,
      alignmentService,
      kiService
    );

    // Populate a sample KI first
    await kiService.upsertKnowledgeItem({
      slug: 'sample-read-ki',
      summary: 'Sample for reading',
      artifacts: [{ name: 'info.txt', content: 'Read test payload' }],
    });

    const { writes, restore } = spyOnFsWrites();

    try {
      // 1. List via kiService & handleListKnowledgeItems
      await kiService.listKnowledgeItems();
      await handlers.handleListKnowledgeItems({});

      // 2. Read via kiService & handleReadKnowledgeItem
      const item = await kiService.readKnowledgeItem('sample-read-ki');
      expect(item).not.toBeNull();
      const readRes = await handlers.handleReadKnowledgeItem({
        slug: 'sample-read-ki',
      });
      expect(readRes.isError).toBe(false);

      // (c) Assert reads never write to clientRoot or mutate file content
      const clientWrites = writes.filter((w) =>
        w.path.startsWith(fakeClientRepo.root)
      );
      expect(clientWrites).toHaveLength(0);

      const fileMutations = writes.filter(
        (w) =>
          w.method.includes('writeFile') ||
          w.method.includes('appendFile') ||
          w.method.includes('rm')
      );
      expect(fileMutations).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('covers create + delete staying inside the home store', async () => {
    const kiService = new KiService();
    const beforeTree = snapshotTree(fakeClientRepo.root);
    const { writes, restore } = spyOnFsWrites();

    try {
      const slug = 'temp-delete-ki';
      const expectedKiPath = path.join(
        fakeHomeDir,
        '.gemini',
        'antigravity',
        'knowledge',
        slug
      );

      // Create KI
      await kiService.upsertKnowledgeItem({
        slug,
        summary: 'To be deleted',
        artifacts: [{ name: 'trash.txt', content: 'disposable' }],
      });
      expect(fs.existsSync(expectedKiPath)).toBe(true);

      // Delete KI
      const deleted = await kiService.deleteKnowledgeItem(slug);
      expect(deleted).toBe(true);
      expect(fs.existsSync(expectedKiPath)).toBe(false);

      // Assert all file mutations occurred inside fakeHomeDir and zero inside clientRoot
      const clientWrites = writes.filter((w) =>
        w.path.startsWith(fakeClientRepo.root)
      );
      expect(clientWrites).toHaveLength(0);

      const afterTree = snapshotTree(fakeClientRepo.root);
      assertNoRepoWrites(beforeTree, afterTree, { allow: [] });
    } finally {
      restore();
    }
  });

  it('supports round-trip approval state (create -> setApproval -> read)', async () => {
    const kiService = new KiService();
    const slug = 'approval-roundtrip-test';

    // 1. Create with default approval state
    await kiService.upsertKnowledgeItem({
      slug,
      summary: 'Test approval state',
      artifacts: [{ name: 'test.txt', content: 'test' }],
    });

    let readKi = await kiService.readKnowledgeItem(slug);
    expect(readKi?.metadata.approval?.status).toBeUndefined(); // or whatever default it holds

    // 2. Set approval state
    await kiService.setApproval(slug, 'human-approved', 'test-user');

    // 3. Read back and verify
    readKi = await kiService.readKnowledgeItem(slug);
    expect(readKi?.metadata.approval).toBeDefined();
    expect(readKi?.metadata.approval?.status).toBe('human-approved');
    expect(readKi?.metadata.approval?.by).toBe('test-user');
    expect(readKi?.metadata.approval?.timestamp).toBeDefined();
  });
});
