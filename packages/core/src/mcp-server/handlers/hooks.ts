import * as fs from 'fs/promises';
import * as path from 'path';
import { KiService } from '../../lib/ki/ki-service.js';
import { FileSystemService } from '../../lib/skills/fs-service.js';

export class HookHandlers {
  constructor(
    private fsService: FileSystemService,
    private kiService: KiService
  ) {}

  /**
   * @desc Evaluates hooks/guards for a given skill execution request.
   */
  async evaluateHooks(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ allowed: boolean; refusalPayload?: any }> {
    const isDiscreteTool =
      toolName.startsWith('get_') &&
      toolName !== 'get_skill' &&
      toolName !== 'get_skills';
    let safeSkillName = '';
    if (isDiscreteTool) {
      safeSkillName = toolName.replace(/^get_/, '').replace(/_/g, '-');
    } else if (toolName === 'get_skill' || toolName === 'get_skills') {
      const skillName = args.skillName as string | undefined;
      safeSkillName = path.basename(skillName || 'unknown', '.md');
    } else {
      return { allowed: true };
    }

    const graph = await this.fsService.loadGraph();
    if (!graph || !graph.nodes) return { allowed: true };

    const node = graph.nodes.find((n: any) => n.id === safeSkillName);
    if (!node) return { allowed: true };

    const phase = node.phase;
    const kind = node.kind;

    const hooksDir = path.join(process.cwd(), '.ai', 'hooks');
    let guards: any[] = [];
    try {
      const files = await fs.readdir(hooksDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(hooksDir, file), 'utf-8');
          guards.push(JSON.parse(content));
        }
      }
    } catch {
      return { allowed: true };
    }

    const actorType = (args.actorType as string) || 'USER';

    for (const guard of guards) {
      let applies = false;
      if (guard.appliesToPhase && guard.appliesToPhase.includes(phase))
        applies = true;
      if (guard.appliesToKind && guard.appliesToKind.includes(kind))
        applies = true;
      if (!applies) continue;

      const cond = guard.condition || {};
      let triggered = false;

      if (cond.actorTypeNot && actorType !== cond.actorTypeNot) {
        triggered = true;
      }

      if (cond.requireKi) {
        if ((cond.requireKi === 'spec' || cond.requireKi === 'feature-spec') && args.story) {
          // satisfied via direct entry
        } else if ((cond.requireKi === 'slice-set' || cond.requireKi === 'atomic-batches') && args.slice) {
          // satisfied via direct entry
        } else {
          const ki = await this.kiService.readKnowledgeItem(cond.requireKi);
          if (cond.requireKiStatus) {
            if (!ki || ki.metadata.approval?.status !== cond.requireKiStatus) {
              triggered = true;
            }
          } else if (!ki) {
            triggered = true;
          }
        }
      }

      if (cond.consumesApprovedKi) {
        const consumes = graph.artifactFlow
          ? graph.artifactFlow
              .filter((f: any) => f.consumedBy?.includes(phase))
              .map((f: any) => f.type)
          : [];
        for (const type of consumes) {
          if ((type === 'spec' || type === 'feature-spec') && args.story) continue;
          if ((type === 'slice-set' || type === 'atomic-batches') && args.slice) continue;
          
          const ki = await this.kiService.readKnowledgeItem(type);
          if (
            ki &&
            (!ki.metadata.approval ||
              ki.metadata.approval.status !== 'human-approved')
          ) {
            triggered = true;
            break;
          }
        }
      }

      if (triggered) {
        if (
          guard.action === 'block' ||
          guard.action === 'require-human-approve'
        ) {
          return {
            allowed: false,
            refusalPayload: {
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
              isError: false,
            },
          };
        }
      }
    }
    return { allowed: true };
  }
}
