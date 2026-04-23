import { telemetryService } from '../lib/telemetry-service';
import {
  isSkillTrace,
  normalizeProjectName,
  normalizeSkillName,
} from '../lib/trace-utils';
import { UserResolver } from './user-resolver';

export interface ITelemetry {
  withAnalytics<T>(
    skillName: string,
    projectName: string | undefined,
    model: string | undefined,
    agent: string | undefined,
    skillCost: string | undefined,
    executeCallback: () => Promise<T>,
    overrides?: { userEmail?: string; userRole?: string }
  ): Promise<T>;
}

/**
 * Telemetry orchestration for MCP server.
 * Delegates actual recording to the unified TelemetryService.
 */
export class Telemetry implements ITelemetry {
  private userResolver: UserResolver;

  constructor() {
    this.userResolver = new UserResolver();
  }

  async withAnalytics<T>(
    skillName: string,
    projectName: string | undefined,
    model: string | undefined,
    agent: string | undefined,
    skillCost: string | undefined,
    executeCallback: () => Promise<T>,
    overrides?: { userEmail?: string; userRole?: string }
  ): Promise<T> {
    const normalizedSkill = normalizeSkillName(skillName);
    const startTime = Date.now();

    // Skip internal/system traces
    if (isSkillTrace(undefined, normalizedSkill)) {
      return executeCallback();
    }

    const userEmail = overrides?.userEmail || this.userResolver.getUserEmail();
    const userName = this.userResolver.getUserName();
    const normalizedProject = normalizeProjectName(projectName);

    let status: 'SUCCESS' | 'ERROR' = 'SUCCESS';
    let errorMessage: string | undefined;
    let completionTokens = 0;
    let promptTokens = 500; // Baseline for MCP metadata

    try {
      const result = await executeCallback();
      const outputStr =
        typeof result === 'string' ? result : JSON.stringify(result);
      completionTokens = Math.ceil(outputStr.length / 4);
      return result;
    } catch (error: unknown) {
      status = 'ERROR';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;

      try {
        if (telemetryService?.recordEvent) {
          await telemetryService.recordEvent({
            skillName,
            projectName: normalizedProject,
            model,
            agent,
            duration,
            status,
            error: errorMessage,
            promptTokens,
            completionTokens,
            userEmail,
            metadata: {
              userName,
              skillCost: skillCost || 'unknown',
              source: 'mcp',
            },
          });
        } else {
          console.error(
            '[MCP Telemetry] telemetryService unavailable - skipping recording.'
          );
        }
      } catch (logError) {
        console.error(
          '[MCP Telemetry] Failed to delegate recording:',
          logError
        );
      }
    }
  }
}
