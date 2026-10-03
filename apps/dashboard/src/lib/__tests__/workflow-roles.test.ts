import { canAccessWorkflow, getWorkflowsForRole } from '@/lib/workflow-roles';

describe('workflow-roles', () => {
  describe('show-it', () => {
    it.each(['DEVELOPER', 'PM', 'DESIGNER', 'QA'])(
      'grants access to the %s role',
      (role) => {
        expect(canAccessWorkflow(role, 'show-it')).toBe(true);
      }
    );

    it('appears in the slash menu for a PM with its own description', () => {
      const showIt = getWorkflowsForRole('PM').find((w) => w.name === 'show-it');

      expect(showIt).toBeDefined();
      expect(showIt?.description).not.toBe('Execute workflow');
    });
  });

  it('denies an unmapped workflow to a non-admin role', () => {
    expect(canAccessWorkflow('PM', 'not-a-real-workflow')).toBe(false);
  });
});
