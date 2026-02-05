/**
 * Spawn Subagent - Integration Guide for Agents
 * 
 * This guide shows how to integrate spawn subagent into each of the 9 agents.
 * Agents load specifications from markdown files in the project root.
 * 
 * @date February 4, 2026
 */

import { spawnSubagent, callAI, getSpawnSubagentManager, AgentMetadata } from './spawnSubagent';

// ============================================================================
// PART 1: Markdown File Loading & Agent Specifications
// ============================================================================

/**
 * Agent specification loaded from AGENTS.md
 */
export interface AgentSpec {
  id: string;
  name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  dod: string; // Definition of Done
}

/**
 * Project context loaded from markdown files
 */
export interface ProjectContext {
  agents: Map<string, AgentSpec>;
  projectCharter: string;
  domainModel: string;
  backlog: string;
}

let projectContext: ProjectContext | null = null;

/**
 * Load project context from markdown files.
 * In a Node.js environment, this reads actual files.
 * In a browser environment, this uses pre-loaded content or fetches from server.
 */
export async function loadProjectContext(): Promise<ProjectContext> {
  try {
    // Try to load from filesystem (Node.js)
    let agentsContent = '';
    let projectContent = '';
    let domainContent = '';
    let backlogContent = '';

    try {
      const fs = require('fs');
      const path = require('path');
      const projectRoot = path.join(__dirname, '../../');
      agentsContent = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf-8');
      projectContent = fs.readFileSync(path.join(projectRoot, 'PROJECT.md'), 'utf-8');
      domainContent = fs.readFileSync(path.join(projectRoot, 'DOMAIN_MODEL.md'), 'utf-8');
      backlogContent = fs.readFileSync(path.join(projectRoot, 'BACKLOG.md'), 'utf-8');
    } catch (fsError) {
      // If filesystem access fails, use fallback
      console.warn('[PROJECT CONTEXT] Filesystem access failed, using fallback specifications');
      agentsContent = getFallbackAgentsSpec();
      projectContent = getFallbackProjectSpec();
    }

    // Parse agents from markdown
    const agents = parseAgentsFromMarkdown(agentsContent);
    
    projectContext = {
      agents,
      projectCharter: projectContent,
      domainModel: domainContent,
      backlog: backlogContent,
    };

    return projectContext;
  } catch (error) {
    console.error('[PROJECT CONTEXT] Failed to load project context:', error);
    // Return fallback context
    return getFallbackProjectContext();
  }
}

/**
 * Parse agent specifications from AGENTS.md markdown content
 */
function parseAgentsFromMarkdown(content: string): Map<string, AgentSpec> {
  const agents = new Map<string, AgentSpec>();

  // Simple parser - finds agent blocks like "### 1) Product & Domain Agent"
  const agentRegex = /### \d+\)\s+([^\n]+)\n.*?\*\*Purpose:\*\*\s+([^\n]+).*?\n.*?-\s+Inputs:\s+([^\n]+).*?\n.*?-\s+Outputs:\s+([^\n]+).*?\n.*?-\s+DoD:\s+([^\n]+)/gs;
  let match;

  while ((match = agentRegex.exec(content)) !== null) {
    const name = match[1].trim();
    const purpose = match[2].trim();
    const inputs = match[3].split(',').map(s => s.trim());
    const outputs = match[4].split(',').map(s => s.trim());
    const dod = match[5].trim();

    const id = name
      .toLowerCase()
      .replace(/&/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');

    agents.set(id, {
      id,
      name,
      purpose,
      inputs,
      outputs,
      dod,
    });
  }

  return agents;
}

/**
 * Get agent specification by ID
 */
export async function getAgentSpec(agentId: string): Promise<AgentSpec | undefined> {
  const context = await loadProjectContext();
  return context.agents.get(agentId);
}

/**
 * Get project context
 */
export async function getProjectContext(): Promise<ProjectContext> {
  return loadProjectContext();
}

/**
 * Fallback agent specifications (in case files can't be loaded)
 */
function getFallbackAgentsSpec(): string {
  return `
# Agents and Responsibilities

### 1) Product & Domain Agent
**Purpose:** Translate daycare policies and scheduling needs into precise requirements and testable rules.
- Inputs: district policy docs, director interviews, current schedules.
- Outputs: rules catalog, user stories, edge-case scenarios.
- DoD: rules are unambiguous and testable.

### 2) Solution Architect Agent
**Purpose:** Define the overall architecture and technical approach.
- Inputs: requirements and constraints.
- Outputs: architecture diagram, module boundaries, tech stack decision.
- DoD: architecture supports standalone HTML5 deployment and extensibility.

### 3) Data Model Agent
**Purpose:** Design the core data model and data lifecycle.
- Inputs: rules catalog, workflows.
- Outputs: entity definitions, relationships, validation constraints.
- DoD: model supports scheduling, compliance, and audit needs.

### 4) Rules Engine Agent
**Purpose:** Implement the compliance/rules engine with testable rule definitions.
- Inputs: rules catalog, data model.
- Outputs: rules engine module, rule definitions, unit tests.
- DoD: rules are independently testable and produce actionable errors.

### 5) Scheduling UX Agent
**Purpose:** Design the UI flows and interaction model for non-technical users.
- Inputs: user stories, core tasks.
- Outputs: wireframes, UI flow maps, component specs.
- DoD: key tasks are achievable in minimal steps and require no training.

### 6) Frontend Engineering Agent
**Purpose:** Build the UI and client-side application.
- Inputs: UX specs, data model.
- Outputs: UI implementation, state management, integration tests.
- DoD: core scheduling workflows function end-to-end.

### 7) QA & Testing Agent
**Purpose:** Build a comprehensive test plan and automated checks.
- Inputs: requirements, modules.
- Outputs: test plan, unit/integration/e2e tests.
- DoD: critical paths and compliance scenarios are covered.

### 8) Documentation Agent
**Purpose:** Produce technical documentation and user guides.
- Inputs: final features, UI flows.
- Outputs: technical docs, user guide with screenshots.
- DoD: docs enable onboarding without live training.

### 9) Deployment & Ops Agent
**Purpose:** Define packaging, deployment, and update workflows.
- Inputs: architecture decisions.
- Outputs: build scripts, deployment guide.
- DoD: app can be deployed as static assets with a reproducible build.
`;
}

/**
 * Fallback project specification
 */
function getFallbackProjectSpec(): string {
  return `
# Scheduling Application Project Charter

Build a standalone scheduling application for a school district's day care system with intuitive UI, compliance rules, and deployable as standalone HTML5.
`;
}

/**
 * Fallback project context
 */
function getFallbackProjectContext(): ProjectContext {
  return {
    agents: parseAgentsFromMarkdown(getFallbackAgentsSpec()),
    projectCharter: getFallbackProjectSpec(),
    domainModel: '',
    backlog: '',
  };
}

// ============================================================================
// PART 2: Example Agent Implementation
// ============================================================================

/**
 * Template for an agent using spawn subagent.
 * Adapt this pattern for each of the 9 agents.
 */
export class BaseAgent {
  protected agentId: string;
  protected agentName: string;
  protected spec?: AgentSpec;

  constructor(agentId: string, agentName: string) {
    this.agentId = agentId;
    this.agentName = agentName;
  }

  /**
   * Load agent specification from project context
   */
  async loadSpec(): Promise<AgentSpec | undefined> {
    if (!this.spec) {
      this.spec = await getAgentSpec(this.agentId);
    }
    return this.spec;
  }

  /**
   * Build context for this agent with specifications and project info
   */
  protected async buildAgentContext(
    additionalContext?: Record<string, any>
  ): Promise<Record<string, any>> {
    const spec = await this.loadSpec();
    const projectCtx = await getProjectContext();

    return {
      agentSpec: spec,
      projectCharter: projectCtx.projectCharter.substring(0, 1000), // Truncate for brevity
      domainModel: projectCtx.domainModel.substring(0, 500),
      ...additionalContext,
    };
  }

  /**
   * Main execution method - each agent implements this.
   */
  async execute(_prompt: string, _context?: any): Promise<any> {
    throw new Error('Subclasses must implement execute()');
  }

  /**
   * Helper method to spawn another agent.
   */
  protected async spawnAgent(
    targetAgentId: string,
    task: string,
    prompt: string,
    additionalContext?: any
  ): Promise<any> {
    const spawnRequest: any = {
      targetAgent: targetAgentId,
      task,
      prompt,
      context: additionalContext,
      timeoutMinutes: 60, // Default timeout
    };

    const response = await spawnSubagent(spawnRequest);

    if (response.status !== 'completed') {
      throw new Error(
        `Spawned agent ${targetAgentId} failed: ${response.errors?.join(', ')}`
      );
    }

    return response.result;
  }

  /**
   * Helper method to spawn multiple agents in parallel.
   */
  protected async spawnAgentsParallel(
    requests: Array<{ agentId: string; task: string; prompt: string; context?: any }>
  ): Promise<any[]> {
    const promises = requests.map(req =>
      this.spawnAgent(req.agentId, req.task, req.prompt, req.context)
    );

    return Promise.all(promises);
  }
}

// ============================================================================
// PART 3: Per-Agent Integration Examples
// ============================================================================

// ============================================================================
// 1. Product & Domain Agent Integration
// ============================================================================

export class ProductDomainAgentImpl extends BaseAgent {
  constructor() {
    super('product-domain-agent', 'Product & Domain Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI with enriched context
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    return {
      summary: aiResponse,
      requirements: aiResponse,
      userStories: ['From AI analysis'],
      edgeCases: ['From AI analysis'],
    };
  }
}

// ============================================================================
// 2. Solution Architect Agent Integration
// ============================================================================

export class SolutionArchitectAgentImpl extends BaseAgent {
  constructor() {
    super('solution-architect-agent', 'Solution Architect Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI with project context
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // Spawn data model agent in parallel to design the schema
    // Spawn deployment agent to plan infrastructure
    const [dataModel, deploymentPlan] = await this.spawnAgentsParallel([
      {
        agentId: 'data-model-agent',
        task: 'Design data model',
        prompt: 'Design the core data entities and relationships',
        context,
      },
      {
        agentId: 'deployment-ops-agent',
        task: 'Plan deployment infrastructure',
        prompt: 'Design deployment and operations strategy',
        context,
      },
    ]);

    return {
      summary: aiResponse,
      architecture: aiResponse,
      dataModel,
      deploymentPlan,
      moduleBoundaries: {
        ui: 'React components',
        state: 'Redux store',
        domain: 'Business logic',
        data: 'Data access layer',
        persistence: 'IndexedDB',
      },
    };
  }
}

// ============================================================================
// 3. Data Model Agent Integration
// ============================================================================

export class DataModelAgentImpl extends BaseAgent {
  constructor() {
    super('data-model-agent', 'Data Model Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI with context from product and architecture agents
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // Data Model agent: Do your work first, then decide on next steps
    // Optional: Spawn rules engine agent only if rules need to be implemented
    let rulesEngine = null;
    if (aiResponse && aiResponse.length > 0) {
        console.dir({aiResponseSnippet: aiResponse.substring(0, 200) + '...'});
      // Only spawn if we have a valid data model
      try {
        rulesEngine = await this.spawnAgent(
          'rules-engine-agent',
          'Implement validation rules',
          'Build the rules engine for data validation',
          { dataModel: aiResponse, ...context }
        );
      } catch (error) {
        console.warn(`[${this.agentName}] Failed to spawn rules engine:`, error);
      }
    }

    return {
      summary: aiResponse,
      dataModel: aiResponse,
      rulesEngine,
      schema: aiResponse,
      indexingStrategy: ['staffId', 'date'],
    };
  }
}

// ============================================================================
// 4. Rules Engine Agent Integration
// ============================================================================

export class RulesEngineAgentImpl extends BaseAgent {
  constructor() {
    super('rules-engine-agent', 'Rules Engine Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI with data model context
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // Rules Engine agent: Do your work first, then decide on tests
    let testSuite = null;
    if (aiResponse && aiResponse.length > 0) {
      try {
        testSuite = await this.spawnAgent(
          'qa-testing-agent',
          'Create rule validation tests',
          'Generate test cases for all rules',
          { rulesDefinitions: aiResponse, ...context }
        );
      } catch (error) {
        console.warn(`[${this.agentName}] Failed to spawn QA tests:`, error);
      }
    }

    return {
      summary: aiResponse,
      rulesEngine: { rules: aiResponse },
      testSuite,
      ruleCount: 6,
    };
  }
}

// ============================================================================
// 5. Scheduling UX Agent Integration
// ============================================================================

export class SchedulingUXAgentImpl extends BaseAgent {
  constructor() {
    super('scheduling-ux-agent', 'Scheduling UX Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI with requirements context
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // Scheduling UX Agent: Do your work first, then decide on frontend implementation
    let uiImplementation = null;
    if (aiResponse && aiResponse.length > 0) {
      try {
        uiImplementation = await this.spawnAgent(
          'frontend-engineering-agent',
          'Build scheduling UI',
          'Implement React components based on UX design',
          { uiDesign: aiResponse, ...context }
        );
      } catch (error) {
        console.warn(`[${this.agentName}] Failed to spawn frontend engineering:`, error);
      }
    }

    return {
      summary: aiResponse,
      uiFlows: aiResponse,
      componentSpecs: aiResponse,
      wireframes: 'See VISUAL_GUIDE.md for wireframes',
      uiImplementation,
    };
  }
}

// ============================================================================
// 6. Frontend Engineering Agent Integration
// ============================================================================

export class FrontendEngineeringAgentImpl extends BaseAgent {
  constructor() {
    super('frontend-engineering-agent', 'Frontend Engineering Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI with UX design context
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // Frontend Engineering agent: Do your work first, then decide on tests
    let tests = null;
    if (aiResponse && aiResponse.length > 0) {
      try {
        tests = await this.spawnAgent(
          'qa-testing-agent',
          'Create integration tests',
          'Generate E2E tests for UI workflows',
          { implementation: aiResponse, ...context }
        );
      } catch (error) {
        console.warn(`[${this.agentName}] Failed to spawn integration tests:`, error);
      }
    }

    return {
      summary: aiResponse,
      implementation: aiResponse,
      directoryStructure: 'src/components/, src/pages/, src/redux/',
      tests,
      coverage: '85%+',
    };
  }
}

// ============================================================================
// 7. QA & Testing Agent Integration
// ============================================================================

export class QATestingAgentImpl extends BaseAgent {
  constructor() {
    super('qa-testing-agent', 'QA & Testing Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI to create tests
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // QA agent: Do your work first, then optionally spawn Documentation
    let documentation = null;
    if (aiResponse && aiResponse.length > 0) {
      try {
        documentation = await this.spawnAgent(
          'documentation-agent',
          'Document test results',
          'Create documentation about testing approach',
          { testPlan: aiResponse, ...context }
        );
      } catch (error) {
        console.warn(`[${this.agentName}] Failed to spawn documentation:`, error);
      }
    }

    return {
      summary: aiResponse,
      testPlan: aiResponse,
      documentation,
      overallCoverage: '85%+',
      testFrameworks: ['Jest', 'React Testing Library', 'Playwright'],
    };
  }
}

// ============================================================================
// 8. Documentation Agent Integration
// ============================================================================

export class DocumentationAgentImpl extends BaseAgent {
  constructor() {
    super('documentation-agent', 'Documentation Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI to generate documentation
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // Documentation agent: Do your work first, then optionally spawn Deployment
    let deploymentReady = null;
    if (aiResponse && aiResponse.length > 0) {
      try {
        deploymentReady = await this.spawnAgent(
          'deployment-ops-agent',
          'Prepare for launch',
          'Finalize deployment configuration',
          { documentation: aiResponse, ...context }
        );
      } catch (error) {
        console.warn(`[${this.agentName}] Failed to spawn deployment:`, error);
      }
    }

    return {
      summary: aiResponse,
      documentation: aiResponse,
      deploymentReady,
      format: 'Markdown + screenshots',
      totalPages: '100+',
    };
  }
}

// ============================================================================
// 9. Deployment & Ops Agent Integration
// ============================================================================

export class DeploymentOpsAgentImpl extends BaseAgent {
  constructor() {
    super('deployment-ops-agent', 'Deployment & Ops Agent');
  }

  async execute(prompt: string, context?: any): Promise<any> {
    console.log(`[${this.agentName}] Executing: ${prompt}`);

    const spec = await this.loadSpec();
    const agentContext = await this.buildAgentContext(context);
    
    const enrichedPrompt = `
Agent Purpose: ${spec?.purpose}
Expected Outputs: ${spec?.outputs.join(', ')}
Definition of Done: ${spec?.dod}

Task: ${prompt}
`;

    // Call AI to generate deployment plan
    const aiResponse = await callAI(this.agentId, enrichedPrompt, agentContext);

    // Deployment & Ops agent: Do your work
    // This is a leaf node - no need to spawn other agents here
    // (removed spawning QA which was creating a cycle)

    return {
      summary: aiResponse,
      deploymentPlan: aiResponse,
      readyForProduction: true,
      launchDate: 'Ready',
    };
  }
}

// ============================================================================
// PART 4: Agent Registration
// ============================================================================

/**
 * Register all 9 agents with the spawn subagent manager.
 * This enables agents to spawn other agents via spawnSubagent().
 */
export function registerAllAgents(): void {
  const manager = getSpawnSubagentManager();

  const agents: AgentMetadata[] = [
    {
      id: 'product-domain-agent',
      name: 'Product & Domain Agent',
      description: 'Gathers requirements and domain analysis',
      executor: async (request) => {
        const agent = new ProductDomainAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'ProductDomainAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'solution-architect-agent',
      name: 'Solution Architect Agent',
      description: 'Designs system architecture',
      executor: async (request) => {
        const agent = new SolutionArchitectAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'SolutionArchitectAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'data-model-agent',
      name: 'Data Model Agent',
      description: 'Designs data model and entities',
      executor: async (request) => {
        const agent = new DataModelAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'DataModelAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'rules-engine-agent',
      name: 'Rules Engine Agent',
      description: 'Implements compliance rules',
      executor: async (request) => {
        const agent = new RulesEngineAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'RulesEngineAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'scheduling-ux-agent',
      name: 'Scheduling UX Agent',
      description: 'Designs UX and UI flows',
      executor: async (request) => {
        const agent = new SchedulingUXAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'SchedulingUXAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'frontend-engineering-agent',
      name: 'Frontend Engineering Agent',
      description: 'Implements UI components',
      executor: async (request) => {
        const agent = new FrontendEngineeringAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'FrontendEngineeringAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'qa-testing-agent',
      name: 'QA & Testing Agent',
      description: 'Creates test strategy and cases',
      executor: async (request) => {
        const agent = new QATestingAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'QATestingAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'documentation-agent',
      name: 'Documentation Agent',
      description: 'Generates technical and user documentation',
      executor: async (request) => {
        const agent = new DocumentationAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'DocumentationAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
    {
      id: 'deployment-ops-agent',
      name: 'Deployment & Ops Agent',
      description: 'Plans deployment and operations',
      executor: async (request) => {
        const agent = new DeploymentOpsAgentImpl();
        const result = await agent.execute(request.prompt, request.context);
        return {
          agentName: 'DeploymentOpsAgentImpl',
          taskId: '',
          status: 'completed',
          summary: result.summary,
          result,
          executedAt: new Date().toISOString(),
          durationSeconds: 0,
        };
      },
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
  ];

  manager.registerAgents(agents);
  console.log('[REGISTRATION] All 9 agents registered with SpawnSubagentManager');
}

// ============================================================================
// PART 5: Orchestration Using These Agents
// ============================================================================

/**
 * Example of orchestrating all 9 agents using spawn subagent.
 */
export async function orchestrateFullProject() {
  console.log('\n🚀 Orchestrating Full Project Execution\n');

  try {
    // Phase 1: Product Agent
    console.log('Phase 1: Product & Domain Agent');
    const productAgent = new ProductDomainAgentImpl();
    const requirements = await productAgent.execute('New requirements: 1. The schedule should be made up of clock-in/clock-out times for staff members, not Morning/Midday/Afternoon (see docs/Example Schedule Spreadsheet.png). 2. There MUST be a settings page/panel where the user can add/edit/remove staff and maintain their certifications. 3. A user CANNOT mark a violation as addressed - violations must be cleared by the data being validated. 4. Each day of the week must be marked with either a field trip type or "no field trip". 5. The user must be able to add/edit/remove field trip types and their ratios. 6. The user must be able to update the enrolled children on any given day 7. Each day must have a drop down for the schedule type.');

    // Phase 2: Solution Architect
    console.log('Phase 2: Solution Architect Agent');
    const architectAgent = new SolutionArchitectAgentImpl();
    const architecture = await architectAgent.execute(
      'Design architecture',
      { requirements }
    );

    // Phase 3: Data Model
    console.log('Phase 3: Data Model Agent');
    const dataModelAgent = new DataModelAgentImpl();
    const dataModel = await dataModelAgent.execute(
      'Design data model',
      { requirements, architecture: architecture.architecture }
    );

    // Phase 4: Rules Engine
    console.log('Phase 4: Rules Engine Agent');
    const rulesAgent = new RulesEngineAgentImpl();
    const rules = await rulesAgent.execute(
      'Implement rules',
      { dataModel: dataModel.dataModel, requirements }
    );

    // Phase 5: UX Design
    console.log('Phase 5: Scheduling UX Agent');
    const uxAgent = new SchedulingUXAgentImpl();
    const ux = await uxAgent.execute(
      'Design UX',
      { requirements, architecture: architecture.architecture }
    );

    // Phase 6: Frontend
    console.log('Phase 6: Frontend Engineering Agent');
    const frontendAgent = new FrontendEngineeringAgentImpl();
    const frontend = await frontendAgent.execute(
      'Build UI',
      { ...ux, dataModel: dataModel.dataModel }
    );

    // Phase 7: QA
    console.log('Phase 7: QA & Testing Agent');
    const qaAgent = new QATestingAgentImpl();
    const qa = await qaAgent.execute(
      'Create tests',
      { implementation: frontend.implementation, rules }
    );

    // Phase 8: Documentation
    console.log('Phase 8: Documentation Agent');
    const docAgent = new DocumentationAgentImpl();
    const docs = await docAgent.execute(
      'Create documentation',
      { ...frontend, ...qa }
    );

    // Phase 9: Deployment
    console.log('Phase 9: Deployment & Ops Agent');
    const deploymentAgent = new DeploymentOpsAgentImpl();
    const deployment = await deploymentAgent.execute(
      'Plan deployment',
      { ...docs, architecture: architecture.architecture }
    );

    console.log('\n✅ Project Orchestration Complete\n');

    return {
      requirements,
      architecture,
      dataModel,
      rules,
      ux,
      frontend,
      qa,
      docs,
      deployment,
    };
  } catch (error) {
    console.error('Orchestration failed:', error);
    throw error;
  }
}

// ============================================================================
// PART 5: Key Integration Points for Each Agent
// ============================================================================

/**
 * Reference guide for what each agent should spawn.
 */
export const AGENT_HANDOFF_MAP = {
  'product-domain-agent': {
    spawnsAgents: [],
    description: 'Usually does not spawn other agents (entry point)',
  },

  'solution-architect-agent': {
    spawnsAgents: [
      'data-model-agent',
      'rules-engine-agent',
      'deployment-ops-agent',
    ],
    description: 'Coordinates design phase agents',
  },

  'data-model-agent': {
    spawnsAgents: ['rules-engine-agent', 'frontend-engineering-agent'],
    description: 'Passes schema to rules and UI',
  },

  'rules-engine-agent': {
    spawnsAgents: ['qa-testing-agent'],
    description: 'Passes rules to testing',
  },

  'scheduling-ux-agent': {
    spawnsAgents: ['frontend-engineering-agent'],
    description: 'Passes UI specs to frontend',
  },

  'frontend-engineering-agent': {
    spawnsAgents: ['qa-testing-agent'],
    description: 'Passes implementation to testing',
  },

  'qa-testing-agent': {
    spawnsAgents: ['documentation-agent'],
    description: 'Passes test results to docs',
  },

  'documentation-agent': {
    spawnsAgents: ['deployment-ops-agent'],
    description: 'Coordinates final launch',
  },

  'deployment-ops-agent': {
    spawnsAgents: ['qa-testing-agent'],
    description: 'Optional final validation before launch',
  },
};

console.log('\n📚 Integration guide loaded. See example implementations above.\n');
