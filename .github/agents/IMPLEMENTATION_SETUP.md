/**
 * Spawn Subagent Implementation - Complete Setup Guide
 * 
 * This guide walks through every step to get the spawn subagent system
 * running in your project.
 * 
 * @date February 4, 2026
 */

// ============================================================================
// STEP 1: Installation & Dependencies
// ============================================================================

/**
 * 1. Install required dependencies:
 * 
 * npm install
 * npm install --save-dev typescript ts-node ajv
 */

// ============================================================================
// STEP 2: Project Structure
// ============================================================================

/**
 * Expected directory structure:
 * 
 * .github/agents/
 * ├── package.json                    (NPM configuration)
 * ├── tsconfig.json                   (TypeScript configuration)
 * ├── spawnSubagent.ts               (Core implementation)
 * ├── spawnSubagent.examples.ts      (Usage examples)
 * ├── spawnSubagent.integration.ts   (Agent implementations)
 * ├── spawnSubagent.schema.json      (JSON schema)
 * ├── IMPLEMENTATION_README.md        (Quick reference)
 * ├── IMPLEMENTATION_SETUP.md         (This file)
 * ├── SUBAGENT_TOOL.md               (Tool specification)
 * ├── ORCHESTRATION_GUIDE.md         (Coordination patterns)
 * ├── README.md                       (System overview)
 * ├── VISUAL_GUIDE.md                (Architecture diagrams)
 * ├── INDEX.md                        (Navigation guide)
 * ├── SPAWN_SUBAGENT_SUMMARY.md     (Quick summary)
 * ├── SPAWN_SUBAGENT_CHECKLIST.md   (Implementation checklist)
 * └── dist/                          (Build output)
 */

// ============================================================================
// STEP 3: Build the Project
// ============================================================================

/**
 * Compile TypeScript to JavaScript:
 * 
 * npm run build
 * 
 * This generates:
 * - dist/spawnSubagent.js
 * - dist/spawnSubagent.d.ts
 * - dist/spawnSubagent.examples.js
 * - dist/spawnSubagent.integration.js
 */

// ============================================================================
// STEP 4: Initialize Spawn Subagent
// ============================================================================

import { initializeSpawnSubagent, ConsoleLogger } from './spawnSubagent';

/**
 * On application startup, initialize the global manager:
 */
function initializeApplication() {
  // Option 1: With console logging
  const manager = initializeSpawnSubagent(new ConsoleLogger());

  // Option 2: With no logging
  // const manager = initializeSpawnSubagent(new SilentLogger());

  // Option 3: With custom logger
  // const manager = initializeSpawnSubagent(new CustomLogger());

  return manager;
}

// ============================================================================
// STEP 5: Register Your Agents
// ============================================================================

import {
  AgentMetadata,
  AgentExecutorFactory,
} from './spawnSubagent';

/**
 * Create agent metadata for each of your agents.
 * This example registers all 9 scheduling agents.
 */
function getAgentRegistry(): AgentMetadata[] {
  return [
    {
      id: 'product-domain-agent',
      name: 'Product & Domain Agent',
      description: 'Discovers requirements and formalizes scheduling rules',
      executor: AgentExecutorFactory.createMockExecutor('product-domain-agent', 500),
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },

    {
      id: 'solution-architect-agent',
      name: 'Solution Architect Agent',
      description: 'Designs system architecture and technology stack',
      executor: AgentExecutorFactory.createMockExecutor('solution-architect-agent', 500),
      maxConcurrent: 1,
      timeoutMinutes: 30,
    },

    {
      id: 'data-model-agent',
      name: 'Data Model Agent',
      description: 'Designs core data model and database schema',
      executor: AgentExecutorFactory.createMockExecutor('data-model-agent', 500),
      maxConcurrent: 1,
      timeoutMinutes: 30,
    },

    {
      id: 'rules-engine-agent',
      name: 'Rules Engine Agent',
      description: 'Implements compliance rules engine',
      executor: AgentExecutorFactory.createMockExecutor('rules-engine-agent', 500),
      maxConcurrent: 2,
      timeoutMinutes: 120,
    },

    {
      id: 'scheduling-ux-agent',
      name: 'Scheduling UX Agent',
      description: 'Designs UI flows and interaction model',
      executor: AgentExecutorFactory.createMockExecutor('scheduling-ux-agent', 500),
      maxConcurrent: 1,
      timeoutMinutes: 120,
    },

    {
      id: 'frontend-engineering-agent',
      name: 'Frontend Engineering Agent',
      description: 'Builds the scheduling UI',
      executor: AgentExecutorFactory.createMockExecutor('frontend-engineering-agent', 500),
      maxConcurrent: 2,
      timeoutMinutes: 180,
    },

    {
      id: 'qa-testing-agent',
      name: 'QA & Testing Agent',
      description: 'Creates comprehensive test suite',
      executor: AgentExecutorFactory.createMockExecutor('qa-testing-agent', 500),
      maxConcurrent: 3,
      timeoutMinutes: 120,
    },

    {
      id: 'documentation-agent',
      name: 'Documentation Agent',
      description: 'Produces user and technical documentation',
      executor: AgentExecutorFactory.createMockExecutor('documentation-agent', 500),
      maxConcurrent: 1,
      timeoutMinutes: 90,
    },

    {
      id: 'deployment-ops-agent',
      name: 'Deployment & Ops Agent',
      description: 'Handles deployment and operations',
      executor: AgentExecutorFactory.createMockExecutor('deployment-ops-agent', 500),
      maxConcurrent: 1,
      timeoutMinutes: 60,
    },
  ];
}

// ============================================================================
// STEP 6: Complete Startup Sequence
// ============================================================================

/**
 * Run this on application startup to set everything up.
 */
export async function setupSpawnSubagentSystem() {
  console.log('Initializing Spawn Subagent System...\n');

  try {
    // Step 1: Initialize the manager
    const manager = initializeSpawnSubagent(new ConsoleLogger());
    console.log('✓ Manager initialized');

    // Step 2: Get agent registry
    const agents = getAgentRegistry();
    console.log(`✓ Agent registry loaded (${agents.length} agents)`);

    // Step 3: Register all agents
    manager.registerAgents(agents);
    console.log('✓ All agents registered');

    // Step 4: Verify registration
    const metrics = manager.getMetrics();
    console.log(`✓ System ready. Metrics tracking initialized.\n`);

    return manager;
  } catch (error) {
    console.error('Failed to initialize spawn subagent system:', error);
    throw error;
  }
}

// ============================================================================
// STEP 7: Using Spawn Subagent in Your Code
// ============================================================================

import { spawnSubagent } from './spawnSubagent';

/**
 * Example: Basic spawn usage in your agent code.
 */
export async function exampleBasicSpawn() {
  try {
    const response = await spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Design the database schema',
      prompt: 'Create TypeScript interfaces for all daycare entities...',
      context: {
        requirements: {
          supportedRoles: ['Staff', 'Manager', 'Director'],
          trackingNeeds: ['Schedules', 'Violations', 'Certifications'],
        },
      },
      timeoutMinutes: 30,
    });

    if (response.status === 'completed') {
      console.log('✓ Data model created successfully');
      console.log('  Result:', response.result);
      console.log(`  Duration: ${response.durationSeconds}s`);
    } else if (response.status === 'failed') {
      console.error('✗ Data model creation failed:', response.errors);
    } else if (response.status === 'timeout') {
      console.error('✗ Data model creation timed out');
    }

    return response;
  } catch (error) {
    console.error('Error spawning agent:', error);
    throw error;
  }
}

// ============================================================================
// STEP 8: Parallel Execution
// ============================================================================

/**
 * Example: Spawning multiple agents in parallel.
 */
export async function exampleParallelSpawn() {
  console.log('Spawning agents in parallel...\n');

  try {
    // Spawn all three simultaneously
    const [dataModel, rulesEngine, deployment] = await Promise.all([
      spawnSubagent({
        targetAgent: 'data-model-agent',
        task: 'Design data model',
        prompt: 'Create the entity definitions...',
        timeoutMinutes: 30,
      }),

      spawnSubagent({
        targetAgent: 'rules-engine-agent',
        task: 'Implement compliance rules',
        prompt: 'Build the rules evaluation engine...',
        timeoutMinutes: 120,
      }),

      spawnSubagent({
        targetAgent: 'deployment-ops-agent',
        task: 'Plan deployment strategy',
        prompt: 'Design the deployment pipeline...',
        timeoutMinutes: 60,
      }),
    ]);

    console.log('✓ All agents completed');
    console.log(`  Data Model: ${dataModel.summary}`);
    console.log(`  Rules Engine: ${rulesEngine.summary}`);
    console.log(`  Deployment: ${deployment.summary}`);

    return { dataModel, rulesEngine, deployment };
  } catch (error) {
    console.error('Parallel spawn failed:', error);
    throw error;
  }
}

// ============================================================================
// STEP 9: Context Chaining
// ============================================================================

/**
 * Example: Passing results from one agent to another.
 */
export async function exampleContextChaining() {
  console.log('Running chained execution...\n');

  try {
    // Step 1: Product agent defines requirements
    console.log('1. Getting requirements from product agent...');
    const requirementsResponse = await spawnSubagent({
      targetAgent: 'product-domain-agent',
      task: 'Formalize requirements',
      prompt: 'Document all scheduling requirements and constraints...',
      timeoutMinutes: 60,
    });

    if (requirementsResponse.status !== 'completed') {
      throw new Error('Requirements gathering failed');
    }

    const requirements = requirementsResponse.result;
    console.log('✓ Requirements gathered\n');

    // Step 2: Architect uses requirements to design solution
    console.log('2. Designing architecture based on requirements...');
    const architectureResponse = await spawnSubagent({
      targetAgent: 'solution-architect-agent',
      task: 'Design system architecture',
      prompt: 'Design the system architecture based on these requirements...',
      context: { requirements }, // Pass requirements as context
      timeoutMinutes: 30,
    });

    if (architectureResponse.status !== 'completed') {
      throw new Error('Architecture design failed');
    }

    const architecture = architectureResponse.result;
    console.log('✓ Architecture designed\n');

    // Step 3: Data model agent uses architecture decisions
    console.log('3. Designing data model based on architecture...');
    const dataModelResponse = await spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Design data model',
      prompt: 'Design the data model that implements this architecture...',
      context: { requirements, architecture }, // Pass both previous results
      timeoutMinutes: 30,
    });

    if (dataModelResponse.status !== 'completed') {
      throw new Error('Data model design failed');
    }

    console.log('✓ Data model designed\n');

    return {
      requirements,
      architecture,
      dataModel: dataModelResponse.result,
    };
  } catch (error) {
    console.error('Context chaining failed:', error);
    throw error;
  }
}

// ============================================================================
// STEP 10: Monitoring & Metrics
// ============================================================================

import { getSpawnSubagentManager } from './spawnSubagent';

/**
 * Example: Checking execution metrics.
 */
export function exampleMonitoring() {
  const manager = getSpawnSubagentManager();
  const metrics = manager.getMetrics();

  console.log('\n=== Spawn Subagent Metrics ===\n');
  console.log(`Total Spawns:        ${metrics.totalSpawns}`);
  console.log(`Successful:          ${metrics.successCount}`);
  console.log(`Failed:              ${metrics.failureCount}`);
  console.log(`Timed Out:           ${metrics.timeoutCount}`);
  console.log(`Average Duration:    ${metrics.averageDuration.toFixed(2)}s`);
  console.log(`Success Rate:        ${((metrics.successCount / (metrics.totalSpawns || 1)) * 100).toFixed(1)}%\n`);

  if (Object.keys(metrics.agentStats).length > 0) {
    console.log('Per-Agent Statistics:\n');
    for (const [agentId, stats] of Object.entries(metrics.agentStats)) {
      console.log(`${agentId}:`);
      console.log(`  Calls:           ${stats.calls}`);
      console.log(`  Successes:       ${stats.successes}`);
      console.log(`  Success Rate:    ${((stats.successes / stats.calls) * 100).toFixed(1)}%`);
      console.log(`  Avg Duration:    ${stats.averageDuration.toFixed(2)}s\n`);
    }
  }

  return metrics;
}

// ============================================================================
// STEP 11: Error Handling
// ============================================================================

import { SubagentError, ErrorCode } from './spawnSubagent';

/**
 * Example: Comprehensive error handling.
 */
export async function exampleErrorHandling() {
  console.log('Example: Error Handling\n');

  try {
    const response = await spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Design model',
      prompt: 'Create the model...',
      timeoutMinutes: 1, // Short timeout for demo
      retryOnFailure: true,
    });

    // Check response status
    if (response.status === 'completed') {
      console.log('✓ Success:', response.summary);
    } else if (response.status === 'failed') {
      console.error('✗ Agent failed:');
      console.error('  Summary:', response.summary);
      console.error('  Errors:', response.errors);
    } else if (response.status === 'timeout') {
      console.error('✗ Agent timed out after', response.durationSeconds, 'seconds');
    } else if (response.status === 'invalid_request') {
      console.error('✗ Invalid request');
    }

    return response;
  } catch (error) {
    // Handle exceptions
    if (error instanceof SubagentError) {
      console.error(`Error [${error.code}]: ${error.message}`);
      if (error.details) {
        console.error('Details:', error.details);
      }

      // Handle specific error codes
      switch (error.code) {
        case ErrorCode.AGENT_NOT_FOUND:
          console.error('→ Register the agent first');
          break;
        case ErrorCode.AGENT_BUSY:
          console.error('→ Retry later or increase maxConcurrent');
          break;
        case ErrorCode.TIMEOUT:
          console.error('→ Increase timeoutMinutes');
          break;
        case ErrorCode.CONTEXT_OVERFLOW:
          console.error('→ Reduce context size');
          break;
        case ErrorCode.INVALID_REQUEST:
          console.error('→ Check request format');
          break;
        case ErrorCode.EXECUTION_FAILED:
          console.error('→ Check agent implementation');
          break;
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// ============================================================================
// STEP 12: Running the Examples
// ============================================================================

/**
 * Main function - run all examples.
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Spawn Subagent Implementation - Setup & Examples     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Initialize the system
    const manager = await setupSpawnSubagentSystem();

    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));

    // Run examples based on command line argument
    const example = process.argv[2] || 'basic';

    console.log(`Running example: ${example}\n`);

    switch (example) {
      case 'basic':
        await exampleBasicSpawn();
        break;

      case 'parallel':
        await exampleParallelSpawn();
        break;

      case 'chaining':
        await exampleContextChaining();
        break;

      case 'monitoring':
        exampleMonitoring();
        break;

      case 'error':
        await exampleErrorHandling();
        break;

      default:
        console.log('Unknown example. Available: basic, parallel, chaining, monitoring, error');
    }

    // Show final metrics
    await new Promise(r => setTimeout(r, 500));
    exampleMonitoring();

    console.log('\n✅ Examples complete\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// ============================================================================
// QUICK REFERENCE
// ============================================================================

/**
 * Quick Command Reference
 * 
 * Install dependencies:
 *   npm install
 * 
 * Build TypeScript:
 *   npm run build
 * 
 * Run examples:
 *   npm run examples
 *   npm run examples basic
 *   npm run examples parallel
 *   npm run examples chaining
 * 
 * Run integration tests:
 *   npm run integration
 * 
 * Run tests:
 *   npm test
 *   npm run test:coverage
 * 
 * Format code:
 *   npm run format
 * 
 * Lint code:
 *   npm run lint
 */

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/**
 * Common Issues & Solutions
 * 
 * 1. "Module not found: ajv"
 *    → npm install ajv
 * 
 * 2. "Agent not found"
 *    → Make sure agent is registered in getAgentRegistry()
 *    → Check agent ID matches exactly
 * 
 * 3. "Agent is at maximum concurrency"
 *    → Increase maxConcurrent in agent metadata
 *    → Or queue the request and retry later
 * 
 * 4. "Timeout exceeded"
 *    → Increase timeoutMinutes in request
 *    → Or optimize agent implementation
 * 
 * 5. "Context size exceeds limit"
 *    → Reduce context data to < 10MB
 *    → Split into multiple requests
 * 
 * 6. TypeScript compilation errors
 *    → npm run build
 *    → Check tsconfig.json
 * 
 * 7. Tests failing
 *    → npm run test
 *    → npm run test:coverage
 *    → Check jest configuration in package.json
 */

// Uncomment to run:
// main();

export {
  setupSpawnSubagentSystem,
  getAgentRegistry,
  exampleBasicSpawn,
  exampleParallelSpawn,
  exampleContextChaining,
  exampleMonitoring,
  exampleErrorHandling,
};
