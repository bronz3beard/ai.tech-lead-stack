import { CodebaseHandlers } from '../handlers/codebase';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');

describe('CodebaseHandlers.handleApplyPatch', () => {
  const originalCwd = process.cwd;
  let tmpDir = '/mock/target/dir';

  beforeEach(() => {
    jest.clearAllMocks();
    process.cwd = jest.fn().mockReturnValue(tmpDir);
  });

  afterAll(() => {
    process.cwd = originalCwd;
  });

  it('successfully applies a patch to an existing file', async () => {
    const handler = new CodebaseHandlers();
    const filePath = 'src/test.ts';
    const fullPath = path.resolve(tmpDir, filePath);

    const mockContent = 'line 1\nline 2\nline 3\nline 4\nline 5\n';
    (fs.readFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p === fullPath) return mockContent;
      throw new Error('Not found');
    });

    const patch = `<<<<<<< SEARCH\nline 2\nline 3\n=======\nreplaced 2 and 3\n>>>>>>> REPLACE`;

    const result = await handler.handleApplyPatch({ path: filePath, patch });

    expect(result.isError).toBeFalsy();
    expect(fs.writeFile).toHaveBeenCalledWith(
      fullPath,
      'line 1\nreplaced 2 and 3\nline 4\nline 5\n',
      'utf8'
    );
  });

  it('creates a new file when file does not exist and search is empty', async () => {
    const handler = new CodebaseHandlers();
    const filePath = 'src/new-file.ts';
    const fullPath = path.resolve(tmpDir, filePath);

    (fs.readFile as jest.Mock).mockImplementation(async () => {
      const error: any = new Error('ENOENT');
      error.code = 'ENOENT';
      throw error;
    });

    const patch = `<<<<<<< SEARCH\n=======\nnew content\n>>>>>>> REPLACE`;

    const result = await handler.handleApplyPatch({ path: filePath, patch });
    console.log('Test 1:', result);
    expect(result.isError).toBeFalsy();
    expect(fs.writeFile).toHaveBeenCalledWith(
      fullPath,
      'new content\n',
      'utf8'
    );
  });

  it('returns a structured error if search text is ambiguous (matches multiple times)', async () => {
    const handler = new CodebaseHandlers();
    const filePath = 'src/test.ts';
    const fullPath = path.resolve(tmpDir, filePath);

    const mockContent = 'let a = 1;\nlet a = 1;\n';
    (fs.readFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p === fullPath) return mockContent;
      throw new Error('Not found');
    });

    const patch = `<<<<<<< SEARCH\nlet a = 1;\n=======\nlet a = 2;\n>>>>>>> REPLACE`;

    const result = await handler.handleApplyPatch({ path: filePath, patch });

    expect(result.isError).toBe(true);
    const errorPayload = JSON.parse(result.content[0].text);
    expect(errorPayload.error).toBe('PatchFailed');
    expect(errorPayload.message).toContain('matched 2 times');
  });

  it('returns a structured error if search text is not found', async () => {
    const handler = new CodebaseHandlers();
    const filePath = 'src/test.ts';
    const fullPath = path.resolve(tmpDir, filePath);

    const mockContent = 'let a = 1;\n';
    (fs.readFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p === fullPath) return mockContent;
      throw new Error('Not found');
    });

    const patch = `<<<<<<< SEARCH\nlet b = 1;\n=======\nlet b = 2;\n>>>>>>> REPLACE`;

    const result = await handler.handleApplyPatch({ path: filePath, patch });

    expect(result.isError).toBe(true);
    const errorPayload = JSON.parse(result.content[0].text);
    expect(errorPayload.error).toBe('PatchFailed');
    expect(errorPayload.message).toContain('matched 0 times');
  });

  it('triggers human-approval refusal payload for protected paths', async () => {
    const handler = new CodebaseHandlers();
    const filePath = 'infra/config.ts';

    // Mock hooks reading
    (fs.readdir as jest.Mock).mockResolvedValue(['protected-paths.json']);
    (fs.readFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p.endsWith('protected-paths.json')) {
        return JSON.stringify({
          id: 'protected-paths',
          appliesToPhase: ['build'],
          condition: { diffContains: ['**/auth/**', 'infra/**'] },
          action: 'require-human-approve',
          message: 'Modifications to protected paths require human approval.'
        });
      }
      throw new Error('Not found');
    });

    const patch = `<<<<<<< SEARCH\nfoo\n=======\nbar\n>>>>>>> REPLACE`;

    const result = await handler.handleApplyPatch({ path: filePath, patch });
    console.log('Test 2:', result);
    // It should NOT be an error (to return the payload gracefully as MCP data), 
    // but the content should be a structured refusal.
    expect(result.isError).toBe(false);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.refused).toBe(true);
    expect(payload.escalateTo).toBe('human');
    expect(payload.guardId).toBe('protected-paths');
  });
});
