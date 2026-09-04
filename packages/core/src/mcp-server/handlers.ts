import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { KiService } from '../lib/ki/ki-service.js';
import { AlignmentService } from '../lib/skills/alignment-service.js';
import { FileSystemService } from '../lib/skills/fs-service.js';
import { Telemetry } from './telemetry.js';

import { AlignmentHandlers } from './handlers/alignment.js';
import { CodebaseHandlers } from './handlers/codebase.js';
import { HookHandlers } from './handlers/hooks.js';
import { KnowledgeHandlers } from './handlers/knowledge-items.js';
import { PipelineHandlers } from './handlers/pipeline.js';
import { ReflexionHandlers } from './handlers/reflexion.js';
import { SkillHandlers } from './handlers/skills.js';

/**
 * Handlers manages the execution logic for all MCP tools.
 * Enforces SRP by separating request handling from server configuration.
 * Refactored to delegate to domain-specific handler modules.
 */
export class Handlers {
  private hookHandlers: HookHandlers;
  private skillHandlers: SkillHandlers;
  private knowledgeHandlers: KnowledgeHandlers;
  private alignmentHandlers: AlignmentHandlers;
  private reflexionHandlers: ReflexionHandlers;
  private pipelineHandlers: PipelineHandlers;
  private codebaseHandlers: CodebaseHandlers;

  constructor(
    private fsService: FileSystemService,
    private telemetry: Telemetry,
    private alignmentService: AlignmentService,
    private kiService: KiService
  ) {
    this.hookHandlers = new HookHandlers(this.fsService, this.kiService);
    this.skillHandlers = new SkillHandlers(this.fsService, this.telemetry, this.kiService);
    this.knowledgeHandlers = new KnowledgeHandlers(this.kiService, this.fsService);
    this.alignmentHandlers = new AlignmentHandlers(this.alignmentService);
    this.reflexionHandlers = new ReflexionHandlers();
    this.pipelineHandlers = new PipelineHandlers(this.fsService, this.telemetry);
    this.codebaseHandlers = new CodebaseHandlers();
  }

  async evaluateHooks(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ allowed: boolean; refusalPayload?: any }> {
    return this.hookHandlers.evaluateHooks(toolName, args);
  }

  async handleListSkills() {
    return this.skillHandlers.handleListSkills();
  }

  async handleGetSkill(name: string, args: Record<string, unknown>) {
    return this.skillHandlers.handleGetSkill(name, args);
  }

  async handleVerifyMissionAlignment(args: Record<string, unknown>) {
    return this.alignmentHandlers.handleVerifyMissionAlignment(args);
  }

  async handleListKnowledgeItems(
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    return this.knowledgeHandlers.handleListKnowledgeItems(args);
  }

  async handleApproveKnowledgeItem(
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    return this.knowledgeHandlers.handleApproveKnowledgeItem(args);
  }

  async handleReadKnowledgeItem(args: Record<string, unknown>) {
    return this.knowledgeHandlers.handleReadKnowledgeItem(args);
  }

  async handleCreateKnowledgeItem(args: Record<string, unknown>) {
    return this.knowledgeHandlers.handleCreateKnowledgeItem(args);
  }

  async handleReflexionResume(args: Record<string, any>) {
    return this.reflexionHandlers.handleReflexionResume(args);
  }

  async handleReflexionStatus(args: Record<string, any>) {
    return this.reflexionHandlers.handleReflexionStatus(args);
  }

  async handlePlanPipeline(args: Record<string, unknown>) {
    return this.pipelineHandlers.handlePlanPipeline(args);
  }

  async handleReflexionLoop(args: Record<string, any>) {
    return this.reflexionHandlers.handleReflexionLoop(args);
  }

  async handleRepoMap(args: Record<string, any>) {
    return this.codebaseHandlers.handleRepoMap(args);
  }

  async handleCodeSearch(args: Record<string, any>) {
    return this.codebaseHandlers.handleCodeSearch(args);
  }

  async handleReadRegion(args: Record<string, any>) {
    return this.codebaseHandlers.handleReadRegion(args);
  }
}
