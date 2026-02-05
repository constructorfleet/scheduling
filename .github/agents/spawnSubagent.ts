/**
 * Spawn Subagent Implementation
 * 
 * This module provides the runtime implementation of the spawnSubagent tool,
 * enabling agents to delegate work to other agents with structured handoffs.
 * 
 * @module spawnSubagent
 * @version 1.0.0
 * @date February 4, 2026
 */
import { spawn } from 'child_process';

import Ajv, { JSONSchemaType } from 'ajv';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Structured request for spawning another agent.
 */
export interface SpawnSubagentRequest {
  targetAgent: string;
  task: string;
  prompt: string;
  context?: Record<string, any>;
  expectedOutputFormat?: string;
  timeoutMinutes?: number;
  priority?: 'low' | 'normal' | 'high';
  retryOnFailure?: boolean;
}

/**
 * Structured response from spawned agent.
 */
export interface SubagentResponse {
  agentName: string;
  taskId: string;
  status: 'completed' | 'failed' | 'timeout' | 'invalid_request';
  result?: any;
  summary: string;
  artifacts?: {
    filePath?: string;
    data?: string;
    url?: string;
  };
  executedAt: string;
  durationSeconds: number;
  errors?: string[];
  metrics?: {
    tokensUsed?: number;
    costEstimate?: number;
    retryCount?: number;
  };
}

/**
 * Agent metadata for routing and execution.
 */
export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  executor: (request: SpawnSubagentRequest) => Promise<SubagentResponse>;
  maxConcurrent?: number;
  timeoutMinutes?: number;
  requiredContext?: string[];
}

/**
 * Global metrics tracker.
 */
export interface ExecutionMetrics {
  totalSpawns: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  averageDuration: number;
  agentStats: Record<string, {
    calls: number;
    successes: number;
    failures: number;
    averageDuration: number;
  }>;
}

// ============================================================================
// Error Definitions
// ============================================================================

export enum ErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_BUSY = 'AGENT_BUSY',
  TIMEOUT = 'TIMEOUT',
  CONTEXT_OVERFLOW = 'CONTEXT_OVERFLOW',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
}

export class SubagentError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SubagentError';
  }
}

// ============================================================================
// Spawn Subagent Manager
// ============================================================================

export class SpawnSubagentManager {
  private agents: Map<string, AgentMetadata> = new Map();
  private executionQueue: Map<string, { request: SpawnSubagentRequest; promise: Promise<SubagentResponse> }> = new Map();
  private agentConcurrency: Map<string, number> = new Map();
  private metrics: ExecutionMetrics;
  private validator: Ajv;
  private requestSchema: JSONSchemaType<SpawnSubagentRequest>;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new ConsoleLogger();
    this.metrics = {
      totalSpawns: 0,
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      averageDuration: 0,
      agentStats: {},
    };

    // Initialize AJV for request validation
    this.validator = new Ajv();
    this.requestSchema = {
      type: 'object',
      properties: {
        targetAgent: { type: 'string' },
        task: { type: 'string' },
        prompt: { type: 'string' },
        context: { type: 'object', nullable: true },
        expectedOutputFormat: { type: 'string', nullable: true },
        timeoutMinutes: { type: 'number', nullable: true },
        priority: { type: 'string', enum: ['low', 'normal', 'high'], nullable: true },
        retryOnFailure: { type: 'boolean', nullable: true },
      },
      required: ['targetAgent', 'task', 'prompt'],
    };
  }

  /**
   * Register an agent with the manager.
   */
  public registerAgent(metadata: AgentMetadata): void {
    this.agents.set(metadata.id, metadata);
    this.agentConcurrency.set(metadata.id, metadata.maxConcurrent || 1);
    this.logger.debug(`Agent registered: ${metadata.id}`);
  }

  /**
   * Register multiple agents at once.
   */
  public registerAgents(agentList: AgentMetadata[]): void {
    agentList.forEach(agent => this.registerAgent(agent));
  }

  /**
   * Spawn an agent and wait for its result.
   */
  public async spawn(request: SpawnSubagentRequest): Promise<SubagentResponse> {
    const taskId = this.generateTaskId();
    const startTime = Date.now();

    try {
      // Validate request
      this.validateRequest(request);

      // Check if agent exists
      const agent = this.agents.get(request.targetAgent);
      if (!agent) {
        throw new SubagentError(
          ErrorCode.AGENT_NOT_FOUND,
          `Agent '${request.targetAgent}' not found in registry`
        );
      }

      // Check concurrency limits
      this.checkConcurrency(request.targetAgent);

      // Check context size
      this.checkContextSize(request.context);

      // Log spawn
      this.logger.info(`Spawning agent: ${request.targetAgent} (task: ${taskId})`);

      // Execute with timeout
      const timeoutMs = (request.timeoutMinutes || agent.timeoutMinutes || 30) * 60 * 1000;
      const result = await this.executeWithTimeout(
        () => agent.executor(request),
        timeoutMs,
        taskId
      );

      // Update metrics
      this.updateMetrics(request.targetAgent, true, Date.now() - startTime);

      return {
        ...result,
        taskId,
        executedAt: new Date().toISOString(),
        durationSeconds: (Date.now() - startTime) / 1000,
      };
    } catch (error) {
      // Handle errors
      return this.handleError(
        error,
        request.targetAgent,
        taskId,
        startTime,
        request.retryOnFailure
      );
    }
  }

  /**
   * Spawn an agent without waiting (fire-and-forget).
   */
  public async spawnAsync(request: SpawnSubagentRequest): Promise<string> {
    const taskId = this.generateTaskId();
    
    const promise = this.spawn(request).catch(error => {
      this.logger.error(`Async spawn failed for task ${taskId}:`, error);
      throw error;
    });

    // Store request with promise for tracking
    this.executionQueue.set(taskId, { request, promise });
    
    // Clean up after completion
    promise.finally(() => {
      this.executionQueue.delete(taskId);
    });

    return taskId;
  }

  /**
   * Get the result of a previously spawned async task.
   */
  public async getAsyncResult(taskId: string): Promise<SubagentResponse | null> {
    const execution = this.executionQueue.get(taskId);
    if (!execution) {
      return null;
    }
    try {
      return await execution.promise;
    } catch (error) {
      this.logger.error(`Error retrieving async result for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Validate a spawn request.
   */
  private validateRequest(request: SpawnSubagentRequest): void {
    const validate = this.validator.compile(this.requestSchema);
    
    if (!validate(request)) {
      throw new SubagentError(
        ErrorCode.INVALID_REQUEST,
        'Request validation failed',
        validate.errors
      );
    }

    // Custom validation
    if (!request.targetAgent.match(/^[a-z0-9\-_]+$/i)) {
      throw new SubagentError(
        ErrorCode.INVALID_REQUEST,
        'Invalid agent ID format'
      );
    }

    if (request.prompt.length > 10000) {
      throw new SubagentError(
        ErrorCode.INVALID_REQUEST,
        'Prompt exceeds maximum length (10000 chars)'
      );
    }
  }

  /**
   * Check if agent can accept more concurrent tasks.
   */
  private checkConcurrency(agentId: string): void {
    const agent = this.agents.get(agentId)!;
    const maxConcurrent = agent.maxConcurrent || 1;
    
    // Count current executions for this specific agent
    let currentCount = 0;
    for (const execution of this.executionQueue.values()) {
      if (execution.request.targetAgent === agentId) {
        currentCount++;
      }
    }

    if (currentCount >= maxConcurrent) {
      throw new SubagentError(
        ErrorCode.AGENT_BUSY,
        `Agent '${agentId}' is at maximum concurrency (${maxConcurrent})`
      );
    }
  }

  /**
   * Check if context size is within limits.
   */
  private checkContextSize(context?: Record<string, any>): void {
    if (!context) return;

    const contextStr = JSON.stringify(context);
    const sizeInMB = Buffer.byteLength(contextStr, 'utf8') / (1024 * 1024);

    if (sizeInMB > 10) {
      throw new SubagentError(
        ErrorCode.CONTEXT_OVERFLOW,
        `Context size exceeds limit (${sizeInMB.toFixed(2)}MB > 10MB)`
      );
    }
  }

  /**
   * Execute a function with timeout.
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    taskId: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          reject(new SubagentError(
            ErrorCode.TIMEOUT,
            `Task ${taskId} exceeded timeout of ${timeoutMs}ms`
          ));
        }, timeoutMs)
      ),
    ]);
  }

  /**
   * Handle errors and optionally retry.
   */
private async handleError(
    error: any,
    agentId: string,
    taskId: string,
    startTime: number,
    retry?: boolean
): Promise<SubagentResponse> {
    const duration = Date.now() - startTime;
    const isSubagentError = error instanceof SubagentError;
    const errorCode = isSubagentError ? error.code : ErrorCode.EXECUTION_FAILED;

    this.logger.error(`Task ${taskId} failed:`, error);
    this.updateMetrics(agentId, false, duration);

    if (errorCode === ErrorCode.TIMEOUT) {
        this.metrics.timeoutCount++;
    }

    // Implement optional retry logic
    if (retry) {
        this.logger.info(`Retrying task ${taskId} for agent ${agentId}...`);
        try {
            // Find agent and retry spawn
            const agent = this.agents.get(agentId);
            if (agent) {
                const retryStart = Date.now();
                const result = await agent.executor({
                    targetAgent: agentId,
                    task: 'retry',
                    prompt: 'Retrying previous failed task.',
                    context: {},
                    expectedOutputFormat: undefined,
                    timeoutMinutes: agent.timeoutMinutes,
                    priority: 'normal',
                    retryOnFailure: false, // Prevent infinite retry loop
                });
                this.updateMetrics(agentId, true, Date.now() - retryStart);
                return {
                    ...result,
                    taskId,
                    executedAt: new Date().toISOString(),
                    durationSeconds: (Date.now() - startTime) / 1000,
                    summary: `Retried after failure: ${error.message}`,
                    errors: [error.message, ...(error.details ? [JSON.stringify(error.details)] : [])],
                    metrics: {
                        retryCount: 1,
                    },
                };
            }
        } catch (retryError: any) {
            retryError satisfies Error;
            this.logger.error(`Retry failed for task ${taskId}:`, retryError);
            // Fall through to return original error response
            return {
                agentName: agentId,
                taskId,
                status: 'failed',
                summary: `Retry failed: ${retryError.message}`,
                errors: [
                    `Initial error: ${error.message}`,
                    ...(error.details ? [JSON.stringify(error.details)] : []),
                    `Retry error: ${retryError.message}`,
                    ...(retryError.details ? [JSON.stringify(retryError.details)] : []),
                ],
                executedAt: new Date().toISOString(),
                durationSeconds: (Date.now() - startTime) / 1000,
                metrics: {
                    retryCount: 1,
                },
            };
        }
    }

    return {
        agentName: agentId,
        taskId,
        status: 'failed',
        summary: error.message,
        errors: [error.message, ...(error.details ? [JSON.stringify(error.details)] : [])],
        executedAt: new Date().toISOString(),
        durationSeconds: duration / 1000,
    };
}

  /**
   * Update execution metrics.
   */
  private updateMetrics(agentId: string, success: boolean, duration: number): void {
    // Update global metrics
    this.metrics.totalSpawns++;
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.failureCount++;
    }

    const totalDuration = this.metrics.averageDuration * (this.metrics.totalSpawns - 1) + duration;
    this.metrics.averageDuration = totalDuration / this.metrics.totalSpawns;

    // Update per-agent metrics
    if (!this.metrics.agentStats[agentId]) {
      this.metrics.agentStats[agentId] = {
        calls: 0,
        successes: 0,
        failures: 0,
        averageDuration: 0,
      };
    }

    const stat = this.metrics.agentStats[agentId];
    stat.calls++;
    if (success) {
      stat.successes++;
    } else {
      stat.failures++;
    }

    const agentTotal = stat.averageDuration * (stat.calls - 1) + duration;
    stat.averageDuration = agentTotal / stat.calls;
  }

  /**
   * Get execution metrics.
   */
  public getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Generate a unique task ID.
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Logger Interface
// ============================================================================

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class ConsoleLogger implements Logger {
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

export class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

// ============================================================================
// Global Instance & Singleton
// ============================================================================

let globalManager: SpawnSubagentManager | null = null;

/**
 * Initialize the global spawn subagent manager.
 */
export function initializeSpawnSubagent(logger?: Logger): SpawnSubagentManager {
  globalManager = new SpawnSubagentManager(logger);
  return globalManager;
}

/**
 * Get the global spawn subagent manager.
 */
export function getSpawnSubagentManager(): SpawnSubagentManager {
  if (!globalManager) {
    throw new Error(
      'Spawn subagent manager not initialized. Call initializeSpawnSubagent() first.'
    );
  }
  return globalManager;
}

/**
 * Spawn an agent using the global manager.
 */
export async function spawnSubagent(request: SpawnSubagentRequest): Promise<SubagentResponse> {
  return getSpawnSubagentManager().spawn(request);
}

/**
 * Spawn an agent asynchronously using the global manager.
 */
export async function spawnSubagentAsync(request: SpawnSubagentRequest): Promise<string> {
  return getSpawnSubagentManager().spawnAsync(request);
}

// ============================================================================
// Agent Executor Factory
// ============================================================================

/**
 * Factory for creating mock agent executors for testing.
 */
export class AgentExecutorFactory {
  /**
   * Create a mock executor that simulates agent work.
   */
  static createMockExecutor(agentId: string, delay: number = 1000): 
    (request: SpawnSubagentRequest) => Promise<SubagentResponse> {
    return async (request: SpawnSubagentRequest): Promise<SubagentResponse> => {
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, delay));

      return {
        agentName: agentId,
        taskId: '',
        status: 'completed',
        summary: `Mock execution completed for task: ${request.task}`,
        result: {
          mockData: true,
          taskReceived: request.task,
          contextReceived: !!request.context,
        },
        executedAt: new Date().toISOString(),
        durationSeconds: delay / 1000,
      };
    };
  }

  /**
   * Create an executor that processes and returns context.
   */
  static createContextProcessor(agentId: string):
    (request: SpawnSubagentRequest) => Promise<SubagentResponse> {
    return async (request: SpawnSubagentRequest): Promise<SubagentResponse> => {
      return {
        agentName: agentId,
        taskId: '',
        status: 'completed',
        summary: `Context processed by ${agentId}`,
        result: {
          processedContext: request.context,
          taskDescription: request.task,
        },
        executedAt: new Date().toISOString(),
        durationSeconds: 0.1,
      };
    };
  }

  /**
   * Create an executor that always fails (for testing error handling).
   */
  static createFailingExecutor(agentId: string):
    (request: SpawnSubagentRequest) => Promise<SubagentResponse> {
    return async (): Promise<SubagentResponse> => {
      throw new SubagentError(
        ErrorCode.EXECUTION_FAILED,
        `${agentId} intentionally failed`
      );
    };
  }
}

// ============================================================================
// Export all types and utilities
// ============================================================================

// ============================================================================
// AI Integration
// ============================================================================

type AIProviderRequest = {
    agent: string;
    prompt: string;
    context?: Record<string, any>;
};

/**
 * Call an AI model (Copilot, Codex, or similar) with a prompt.
 * This is a wrapper that can be configured to use different AI providers.
 */
export interface AIProvider {
  call(request: AIProviderRequest): Promise<string>;
}

/**
 * OpenAI/Codex AI Provider
 */
export class OpenAIProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = 'gpt-5.2-codex'
  ) {}

  async call({prompt, context}: AIProviderRequest): Promise<string> {
    const fullPrompt = context
      ? `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`
      : prompt;

    try {
      const args = [
        '--model', this.model,
        '--ask-for-approval',
        'never',
        '--cd',
        process.cwd() + "/src",
        'exec',
        '--skip-git-repo-check',
        fullPrompt,
      ];
      process.env['OPENAI_API_KEY'] = this.apiKey;
      let result: string = "";
      await new Promise<string>((resolve, reject) => {
        const child = spawn('codex', args); // { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        child.stdout.on('data', (data) => {
          process.stdout.write(data);
          result += data.toString();
        });
        child.stderr.on('data', (data) => {
          process.stderr.write(data);
        });
        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Codex process exited with code ${code}`));
          } else {
            resolve(result);
          }
        });
      });
      delete process.env['OPENAI_API_KEY'];
    //   const response = await fetch('https://api.openai.com/v1/completions', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${this.apiKey}`,
    //     },
    //     body: JSON.stringify({
    //       model: this.model,
    //       prompt: fullPrompt,
    //       max_tokens: 2000,
    //       temperature: 0.7,
    //     }),
    //   });

      // if (result.error || result.status !== 0) {
      //   throw new Error(`Codex error: ${result.stderr || 'No output from Codex'}`);
      // }

      return result.trim();
    } catch (error) {
      throw new Error(`Failed to call Codex: ${error}`);
    }
  }
}

/**
 * GitHub Copilot Provider
 */
export class CopilotProvider implements AIProvider {
  constructor() {}

  async call({agent, prompt, context}: AIProviderRequest): Promise<string> {
    const fullPrompt = context
      ? `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`
      : prompt;

    try {
      // Use argument array to avoid shell-escaping issues with quotes/newlines
      const args = [
        '--agent', agent,
        '--prompt', fullPrompt,
        '--allow-all-tools',
        '--add-dir', process.cwd(),
        '--no-ask-user',
        '--silent'
      ];

      console.dir({copilotArgs: args});

      throw new Error("Disabled Copilot calls for now");
      // const result = spawnSync('copilot', args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

      // if (result.error) {
      //   throw result.error;
      // }

      // const stdout = result.stdout ? String(result.stdout) : '';
      // const stderr = result.stderr ? String(result.stderr) : '';

      // if (!stdout) {
      //   console.dir(result);
      //   console.dir({ agent, prompt: fullPrompt, context });
      //   throw new Error(`Copilot API error: ${stderr || 'No output from Copilot'}`);
      // }

      // return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to call Copilot: ${error}`);
    }
  }
}

/**
 * Mock AI Provider for testing (doesn't require API key)
 */
export class MockAIProvider implements AIProvider {
  async call({prompt, context}: AIProviderRequest): Promise<string> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    return `AI Response to: "${prompt.substring(0, 50)}..."\n\nContext received: ${context ? JSON.stringify(context).substring(0, 100) : 'none'}`;
  }
}

let globalAIProvider: AIProvider | null = null;

/**
 * Set the global AI provider.
 */
export function setAIProvider(provider: AIProvider): void {
  globalAIProvider = provider;
}

/**
 * Get the global AI provider.
 */
export function getAIProvider(): AIProvider {
  if (!globalAIProvider) {
    // Default to mock provider if none set
    globalAIProvider = new MockAIProvider();
  }
  return globalAIProvider;
}

/**
 * Configuration for context compression.
 */
interface ContextCompressionConfig {
  maxContextSizeInMB: number;
  compressionThresholdPercent: number;
  enableAutoCompression: boolean;
}

const defaultCompressionConfig: ContextCompressionConfig = {
  maxContextSizeInMB: 10,
  compressionThresholdPercent: 70, // Compress when context reaches 70% of limit
  enableAutoCompression: true,
};

let compressionConfig = defaultCompressionConfig;

/**
 * Set context compression configuration.
 */
export function setCompressionConfig(config: Partial<ContextCompressionConfig>): void {
  compressionConfig = { ...compressionConfig, ...config };
}

/**
 * Get current context size in MB.
 */
export function getContextSize(context?: Record<string, any>): number {
  if (!context) return 0;
  const contextStr = JSON.stringify(context);
  return Buffer.byteLength(contextStr, 'utf8') / (1024 * 1024);
}

/**
 * Compress/prune context using AI to summarize and extract key information.
 * Removes verbose details, condenses nested structures, and keeps only actionable data.
 */
export async function compressContext(
  context: Record<string, any>,
  maxRetentionPercent: number = 50
): Promise<Record<string, any>> {
  const originalSize = getContextSize(context);
  
  const compressionPrompt = `
You are a context compression specialist. Analyze this context object and create a condensed version that:
1. Removes redundant or verbose information
2. Keeps all actionable/critical data
3. Summarizes lengthy descriptions into 1-2 sentences
4. Removes intermediate processing artifacts
5. Merges similar fields where appropriate
6. Converts arrays of similar items into summaries (e.g., "5 configurations" instead of listing all 5)

Original context (${originalSize.toFixed(2)}MB):
${JSON.stringify(context, null, 2).substring(0, 2000)}...

Return ONLY a valid JSON object (no markdown, no explanation) with compressed data that retains ~${maxRetentionPercent}% of the original information density.
`;

  try {
    const compressedJsonStr = await getAIProvider().call({agent: "context-compressor", prompt: compressionPrompt, context});
    
    // Parse the AI response as JSON
    const compressedContext = JSON.parse(compressedJsonStr);
    const compressedSize = getContextSize(compressedContext);
    
    console.info(
      `[CONTEXT COMPRESSION] ${originalSize.toFixed(2)}MB → ${compressedSize.toFixed(2)}MB ` +
      `(${((1 - compressedSize / originalSize) * 100).toFixed(1)}% reduction)`
    );
    
    return compressedContext;
  } catch (error) {
    console.warn(`[CONTEXT COMPRESSION FAILED] Falling back to original context: ${error}`);
    return context;
  }
}

/**
 * Call AI with prompt and context.
 * Automatically compresses context if it exceeds the compression threshold.
 */
export async function callAI(
  agent: string,
  prompt: string,
  context?: Record<string, any>
): Promise<string> {
  let contextToUse = context;
  
  // Check if context needs compression
  if (contextToUse && compressionConfig.enableAutoCompression) {
    const contextSize = getContextSize(contextToUse);
    const compressionThreshold = 
      (compressionConfig.maxContextSizeInMB * compressionConfig.compressionThresholdPercent) / 100;
    
    if (contextSize > compressionThreshold) {
      console.info(
        `[AUTO-COMPRESS] Context size ${contextSize.toFixed(2)}MB exceeds threshold ` +
        `${compressionThreshold.toFixed(2)}MB - compressing...`
      );
      contextToUse = await compressContext(contextToUse);
    }
  }
  
  const response = await getAIProvider().call({agent, prompt, context: contextToUse});
  console.dir({aiCall: {agent, prompt: prompt.substring(0, 100) + '...', contextSize: contextToUse ? getContextSize(contextToUse) : 0}});
  return response;
}

export default {
  SpawnSubagentManager,
  spawnSubagent,
  spawnSubagentAsync,
  initializeSpawnSubagent,
  getSpawnSubagentManager,
  AgentExecutorFactory,
  ConsoleLogger,
  SilentLogger,
  SubagentError,
  ErrorCode,
  callAI,
  getAIProvider,
  setAIProvider,
  OpenAIProvider,
  CopilotProvider,
  MockAIProvider,
  compressContext,
  getContextSize,
  setCompressionConfig,
};
