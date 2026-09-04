import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

describe('Workflow Posture', () => {
  const REPO_ROOT = path.join(__dirname, '../../../..');
  const WORKFLOWS_DIR = path.join(REPO_ROOT, '.agents', 'workflows');
  const PM_WORKFLOWS_DIR = path.join(REPO_ROOT, '.agents', 'pm-workflows');
  const HR_WORKFLOWS_DIR = path.join(REPO_ROOT, '.agents', 'hr-workflows');

  function getWorkflowFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.join(dir, file));
  }

  const allWorkflowPaths = [
    ...getWorkflowFiles(WORKFLOWS_DIR),
    ...getWorkflowFiles(PM_WORKFLOWS_DIR),
    ...getWorkflowFiles(HR_WORKFLOWS_DIR),
  ];

  interface WorkflowData {
    name: string;
    filePath: string;
    modes: string[];
  }

  const parsedWorkflows: WorkflowData[] = allWorkflowPaths.map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const name = parsed.data?.name || path.basename(filePath, '.md');
    const modes = Array.isArray(parsed.data?.modes)
      ? parsed.data.modes.map(String)
      : [];
    return { name, filePath, modes };
  });

  const writeCapableWorkflows = parsedWorkflows.filter(w => w.modes.includes('write'));
  const readOnlyWorkflows = parsedWorkflows.filter(w => !w.modes.includes('write'));

  describe('Frontmatter modes declaration', () => {
    it('ensures every workflow declares a non-empty modes array', () => {
      expect(parsedWorkflows.length).toBeGreaterThan(0);
      for (const workflow of parsedWorkflows) {
        expect(Array.isArray(workflow.modes)).toBe(true);
        expect(workflow.modes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('write-capable workflows', () => {
    it('snapshots the write-capable set to a committed list', () => {
      const sortedWriteCapable = writeCapableWorkflows.map(w => w.name).sort();
      expect(sortedWriteCapable).toMatchSnapshot();
    });
  });

  describe('read-only workflows', () => {
    it('snapshots the read-only set to a committed list', () => {
      const sortedReadOnly = readOnlyWorkflows.map(w => w.name).sort();
      expect(sortedReadOnly).toMatchSnapshot();
    });

    it('ensures strictly-advisory workflows like "ask" are in read-only and NOT in write-capable', () => {
      const strictlyAdvisory = ['ask'];
      const writeNames = writeCapableWorkflows.map(w => w.name);
      const readNames = readOnlyWorkflows.map(w => w.name);

      for (const workflow of strictlyAdvisory) {
        expect(readNames).toContain(workflow);
        expect(writeNames).not.toContain(workflow);
      }
    });
  });
});
