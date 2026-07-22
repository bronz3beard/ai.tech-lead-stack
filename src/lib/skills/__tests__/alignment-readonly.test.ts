import path from 'path';
import fs from 'fs';
import {
  makeFakeClientRepo,
  snapshotTree,
  assertNoRepoWrites,
  spyOnFsWrites,
} from '../../../__tests__/helpers/readonly-harness';
import { AlignmentService } from '../alignment-service';

describe('AlignmentService - Readonly & Controlled Write Compliance', () => {
  let fakeClientRepo: { root: string; cleanup: () => void };

  beforeEach(() => {
    fakeClientRepo = makeFakeClientRepo();
  });

  afterEach(() => {
    fakeClientRepo.cleanup();
  });

  it('allows ONLY .ai/.mission-alignment.json creation under clientRoot upon recordAlignment', async () => {
    const alignmentService = new AlignmentService(fakeClientRepo.root);

    const beforeTree = snapshotTree(fakeClientRepo.root);

    const msg = await alignmentService.recordAlignment(
      'test-agent',
      'fake-client-app'
    );
    expect(msg).toContain('Mission Alignment Recorded');

    const afterTree = snapshotTree(fakeClientRepo.root);

    // The ONLY change allowed under clientRoot is creation of .ai/.mission-alignment.json
    assertNoRepoWrites(beforeTree, afterTree, {
      allow: ['.ai/.mission-alignment.json'],
    });

    // Explicitly verify no files under src/ were modified or created
    expect(fs.existsSync(path.join(fakeClientRepo.root, 'src/index.ts'))).toBe(
      true
    );
    expect(
      fs.readFileSync(path.join(fakeClientRepo.root, 'src/index.ts'), 'utf-8')
    ).toBe('// Fake client source code\nexport const run = () => "client";\n');

    // Verify .ai directory contains ONLY .mission-alignment.json
    const aiEntries = fs.readdirSync(path.join(fakeClientRepo.root, '.ai'));
    expect(aiEntries).toEqual(['.mission-alignment.json']);
  });

  it('verifies re-recording is idempotent and makes no other path changes', async () => {
    const alignmentService = new AlignmentService(fakeClientRepo.root);

    // First record call
    await alignmentService.recordAlignment('test-agent', 'fake-client-app');
    const firstTree = snapshotTree(fakeClientRepo.root);

    // Re-record call
    await alignmentService.recordAlignment('test-agent', 'fake-client-app');
    const secondTree = snapshotTree(fakeClientRepo.root);

    // Idempotence check: only .ai/.mission-alignment.json (timestamp update) changed; no new paths
    assertNoRepoWrites(firstTree, secondTree, {
      allow: ['.ai/.mission-alignment.json'],
    });

    const diffKeys = [];
    for (const key of secondTree.keys()) {
      if (!firstTree.has(key)) diffKeys.push(key);
    }
    expect(diffKeys).toHaveLength(0);
  });

  it('verifies the read/check path (getAlignmentState) writes nothing anywhere', async () => {
    const alignmentService = new AlignmentService(fakeClientRepo.root);

    const { writes, restore } = spyOnFsWrites();

    try {
      // 1. Check alignment state when file does not exist
      const initialState = await alignmentService.getAlignmentState();
      expect(initialState).toBeNull();
      expect(writes).toHaveLength(0);

      // Record alignment to create token
      restore();
      await alignmentService.recordAlignment('test-agent', 'fake-client-app');

      // Re-enable spy to check read path when token exists
      const { writes: readWrites, restore: restoreReadSpy } = spyOnFsWrites();

      try {
        const state = await alignmentService.getAlignmentState();
        expect(state).not.toBeNull();
        expect(state?.aligned).toBe(true);
        expect(state?.agent).toBe('test-agent');

        // Zero writes should occur during getAlignmentState()
        expect(readWrites).toHaveLength(0);
      } finally {
        restoreReadSpy();
      }
    } finally {
      restore();
    }
  });
});
