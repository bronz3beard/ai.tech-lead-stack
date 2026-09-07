import { FileSystemService } from '../../lib/skills/fs-service.js';
import { Telemetry } from '../telemetry.js';

export class PipelineHandlers {
  constructor(
    private fsService: FileSystemService,
    private telemetry: Telemetry
  ) {}

  async handlePlanPipeline(args: Record<string, unknown>) {
    const intent = args.intent as string;
    if (!intent) {
      return {
        content: [{ type: 'text', text: 'Error: "intent" is required.' }],
        isError: true,
      };
    }
    const targets = args.targets as string[] | undefined;
    const domain = args.domain as string | undefined;

    const graph = await this.fsService.loadGraph();
    if (!graph || !graph.nodes) {
      return {
        content: [{ type: 'text', text: 'Error: graph not found.' }],
        isError: true,
      };
    }

    const phases = ['intent', 'specify', 'plan', 'build', 'review', 'deploy'];
    const chain: string[] = [];

    let excludedDueToModelClass = false;
    for (const phase of phases) {
      const candidates = graph.nodes.filter((n: any) => {
        if (n.phase !== phase) return false;
        if (domain && n.domain && n.domain !== domain) return false;
        if (
          targets &&
          targets.length > 0 &&
          n.targets &&
          n.targets.length > 0
        ) {
          if (!targets.some((t: string) => n.targets.includes(t))) return false;
        }
        if (process.env.LOCAL_MODEL_CLASS && n.minModelClass) {
          const w: Record<string, number> = { small: 1, mid: 2, large: 3 };
          const l = w[process.env.LOCAL_MODEL_CLASS.toLowerCase()] || 0;
          const r = w[n.minModelClass.toLowerCase()] || 0;
          if (r > l) {
            excludedDueToModelClass = true;
            return false;
          }
        }
        return true;
      });

      if (candidates.length > 0) {
        const skills = candidates.map((c: any) => c.id).join(', ');
        const flow = graph.artifactFlow?.find((f: any) =>
          f.emittedBy?.includes(phase)
        );
        const emitted = flow ? flow.type : 'none';
        chain.push(`Phase ${phase}: [${skills}] -> emits [${emitted}]`);
      }
    }

    if (excludedDueToModelClass) {
      chain.push(
        '\nNote: Some skills were excluded because they require a larger model or the sub-pro tier.'
      );
    }

    const resultText = chain.join('\n');
    const trackedContent = await this.telemetry.withAnalytics(
      'plan_pipeline',
      undefined,
      undefined,
      undefined,
      'unknown',
      async () => resultText,
      {}
    );

    return {
      content: [{ type: 'text', text: trackedContent }],
      isError: false,
    };
  }
}
