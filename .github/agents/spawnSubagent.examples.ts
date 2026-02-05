/**
 * Spawn Subagent - Usage Examples & Integration Guide
 * 
 * This file demonstrates how to use the spawnSubagent implementation in your agents.
 * 
 * @date February 4, 2026
 */

// ============================================================================
// Example 1: Basic Setup & Initialization
// ============================================================================

import {
  initializeSpawnSubagent,
  spawnSubagent,
  AgentExecutorFactory,
  ConsoleLogger,
} from './spawnSubagent';

/**
 * Initialize the spawn subagent system on application startup.
 */
export async function setupSpawnSubagent() {
  const logger = new ConsoleLogger();
  const manager = initializeSpawnSubagent(logger);

  // Register all 9 agents
  manager.registerAgents([
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
  ]);

  return manager;
}

// ============================================================================
// Example 2: Simple Agent Handoff
// ============================================================================

/**
 * Product agent spawning the data model agent to design the schema.
 */
export async function productAgentHandoff() {
  const response = await spawnSubagent({
    targetAgent: 'data-model-agent',
    task: 'Design the daycare scheduling data model',
    prompt: `
      Based on the following requirements, design a comprehensive data model
      for daycare scheduling:
      
      Requirements:
      - Support staff with different certifications
      - Enforce staff-to-child ratios per state law
      - Handle shift scheduling with breaks
      - Track compliance violations
      
      Output: JSON schema for all entities and relationships
    `,
    context: {
      requirements: [
        { type: 'staffCertification', details: 'Certifications required for field trip' },
      ],
      stateRegulations: 'California Title 22',
    },
    expectedOutputFormat: 'JSON Schema',
    timeoutMinutes: 30,
  });

  console.log('Data Model Response:', response);
  return response;
}

// ============================================================================
// Example 3: Parallel Execution
// ============================================================================

/**
 * Solution architect spawning multiple agents in parallel.
 */
export async function architectSpawnParallel() {
  // Spawn multiple agents concurrently
  const [dataModelResponse, rulesEngineResponse, deploymentResponse] = await Promise.all([
    spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Design daycare data model',
      prompt: 'Create TypeScript interfaces for Staff, Schedule, Certification...',
      context: { requirements: ['support 10+ time segments', 'track 100+ staff'] },
      timeoutMinutes: 30,
    }),

    spawnSubagent({
      targetAgent: 'rules-engine-agent',
      task: 'Implement compliance rules',
      prompt: 'Implement rules engine with 25+ compliance rules...',
      context: { rules: ['staffRatio', 'certification', 'breaks', 'capacity'] },
      timeoutMinutes: 120,
    }),

    spawnSubagent({
      targetAgent: 'deployment-ops-agent',
      task: 'Plan deployment strategy',
      prompt: 'Design deployment for standalone HTML5 app with optional sync...',
      context: { platforms: ['web', 'desktop', 'mobile'] },
      timeoutMinutes: 60,
    }),
  ]);

  console.log('All parallel tasks completed');
  console.log('Data Model:', dataModelResponse.summary);
  console.log('Rules Engine:', rulesEngineResponse.summary);
  console.log('Deployment:', deploymentResponse.summary);

  return { dataModelResponse, rulesEngineResponse, deploymentResponse };
}

// ============================================================================
// Example 4: Chained Execution (Sequential with Context Passing)
// ============================================================================

/**
 * Run a 3-step workflow with context passing.
 */
export async function chainedExecution() {
  // Step 1: Product agent defines requirements
  const step1 = await spawnSubagent({
    targetAgent: 'product-domain-agent',
    task: 'Formalize scheduling requirements',
    prompt: 'Document all scheduling requirements and edge cases...',
    timeoutMinutes: 60,
  });

  if (step1.status !== 'completed') {
    throw new Error('Step 1 failed, cannot continue');
  }

  console.log('Step 1 Completed:', step1.summary);

  // Step 2: Use result from Step 1 as context for Step 2
  const step2 = await spawnSubagent({
    targetAgent: 'solution-architect-agent',
    task: 'Design solution based on requirements',
    prompt: 'Based on the requirements, propose a system architecture...',
    context: {
      requirements: step1.result?.requirements,
      rules: step1.result?.rules,
    },
    timeoutMinutes: 30,
  });

  if (step2.status !== 'completed') {
    throw new Error('Step 2 failed, cannot continue');
  }

  console.log('Step 2 Completed:', step2.summary);

  // Step 3: Use results from both previous steps
  const step3 = await spawnSubagent({
    targetAgent: 'data-model-agent',
    task: 'Design data model for architecture',
    prompt: 'Design the data model based on architecture decisions...',
    context: {
      requirements: step1.result?.requirements,
      architecture: step2.result?.architecture,
      techStack: step2.result?.techStack,
    },
    timeoutMinutes: 30,
  });

  console.log('Step 3 Completed:', step3.summary);

  return { step1, step2, step3 };
}

// ============================================================================
// Example 5: Error Handling with Retry
// ============================================================================

/**
 * Spawn an agent with automatic retry on failure.
 */
export async function spawnWithRetry() {
  try {
    const response = await spawnSubagent({
      targetAgent: 'frontend-engineering-agent',
      task: 'Build scheduling UI components',
      prompt: 'Implement React components for schedule management...',
      context: {
        uiFramework: 'React',
        stateManagement: 'Redux',
        styling: 'Tailwind CSS',
      },
      timeoutMinutes: 180,
      retryOnFailure: true,
      priority: 'high', // High priority in queue
    });

    if (response.status === 'completed') {
      console.log('✓ Frontend build succeeded');
      console.log('  Duration:', response.durationSeconds, 'seconds');
      console.log('  Result:', response.result);
    } else if (response.status === 'timeout') {
      console.error('✗ Frontend build timed out after', response.durationSeconds, 'seconds');
    } else if (response.status === 'failed') {
      console.error('✗ Frontend build failed:', response.errors);
    }

    return response;
  } catch (error) {
    console.error('Error spawning agent:', error);
    throw error;
  }
}

// ============================================================================
// Example 6: Async Fire-and-Forget
// ============================================================================

import { spawnSubagentAsync, getSpawnSubagentManager } from './spawnSubagent';

/**
 * Spawn an agent asynchronously and check result later.
 */
export async function spawnAsyncExample() {
  // Spawn without waiting
  const taskId = await spawnSubagentAsync({
    targetAgent: 'documentation-agent',
    task: 'Generate user documentation',
    prompt: 'Create comprehensive user guide with screenshots...',
    timeoutMinutes: 90,
  });

  console.log('Spawned async task:', taskId);

  // Do other work while agent executes...
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check if task is complete
  const manager = getSpawnSubagentManager();
  const result = await manager.getAsyncResult(taskId);

  if (result) {
    console.log('Task result:', result);
  } else {
    console.log('Task still executing...');
  }

  return taskId;
}

// ============================================================================
// Example 7: Metrics & Monitoring
// ============================================================================

/**
 * Monitor spawn subagent metrics.
 */
export async function monitorMetrics() {
  const manager = getSpawnSubagentManager();

  // Run some spawns
  await Promise.all([
    spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Task 1',
      prompt: 'Prompt 1',
    }),
    spawnSubagent({
      targetAgent: 'rules-engine-agent',
      task: 'Task 2',
      prompt: 'Prompt 2',
    }),
    spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Task 3',
      prompt: 'Prompt 3',
    }),
  ]);

  // Get metrics
  const metrics = manager.getMetrics();

  console.log('\n=== Spawn Subagent Metrics ===');
  console.log(`Total Spawns: ${metrics.totalSpawns}`);
  console.log(`Successes: ${metrics.successCount}`);
  console.log(`Failures: ${metrics.failureCount}`);
  console.log(`Timeouts: ${metrics.timeoutCount}`);
  console.log(`Average Duration: ${metrics.averageDuration.toFixed(2)}s`);

  console.log('\n=== Per-Agent Stats ===');
  for (const [agentId, stats] of Object.entries(metrics.agentStats)) {
    console.log(`${agentId}:`);
    console.log(`  Calls: ${stats.calls}`);
    console.log(`  Successes: ${stats.successes}`);
    console.log(`  Success Rate: ${((stats.successes / stats.calls) * 100).toFixed(1)}%`);
    console.log(`  Avg Duration: ${stats.averageDuration.toFixed(2)}s`);
  }

  return metrics;
}

// ============================================================================
// Example 8: Integrating with an Agent
// ============================================================================

/**
 * Example of how a real agent would use spawn subagent.
 * This shows the pattern for the Product Domain Agent.
 */
export class ProductDomainAgent {
  async executeTask(prompt: string): Promise<any> {
    console.log('Product Domain Agent executing...');

    // Define requirements based on interviews, policies, current schedules
    const requirements = {
      staffRatios: {
        in_house: { max: 4, certified: false },
        full_day: { max: 6, certified: true },
        field_trip: { max: 8, certified: false },
      },
      breaks: {
        minLength: 30,
        minRestPeriod: 4,
      },
      capacity: {
        maxStaffPerDay: 50,
        maxChildrenPerDay: 150,
      },
    };

    // Now, spawn the data model agent to translate these into a schema
    const dataModelResponse = await spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Design data model from requirements',
      prompt: 'Based on these requirements, design the data model...',
      context: requirements,
      expectedOutputFormat: 'TypeScript interfaces',
      timeoutMinutes: 30,
    });

    return {
      requirements,
      dataModelOutput: dataModelResponse.result,
    };
  }
}

/**
 * Example of how the Solution Architect Agent would use spawn subagent.
 */
export class SolutionArchitectAgent {
  async executeTask(requirements: any): Promise<any> {
    console.log('Solution Architect Agent executing...');

    // Make architecture decisions
    const architecture = {
      pattern: 'Layered Architecture',
      layers: ['UI', 'State', 'Domain Logic', 'Data Access', 'Persistence'],
      deployment: 'Standalone HTML5 + optional sync',
    };

    // Spawn multiple agents in parallel for concurrent work
    const [dataModel, rules, deployment] = await Promise.all([
      spawnSubagent({
        targetAgent: 'data-model-agent',
        task: 'Design entities and relationships',
        prompt: 'Design data model for our layered architecture...',
        context: { architecture, requirements },
        timeoutMinutes: 30,
      }),

      spawnSubagent({
        targetAgent: 'rules-engine-agent',
        task: 'Implement compliance rules',
        prompt: 'Implement rules engine for our architecture...',
        context: { architecture, requirements },
        timeoutMinutes: 120,
      }),

      spawnSubagent({
        targetAgent: 'deployment-ops-agent',
        task: 'Plan deployment for HTML5 app',
        prompt: 'Create deployment plan for standalone HTML5...',
        context: { architecture, requirements },
        timeoutMinutes: 60,
      }),
    ]);

    return {
      architecture,
      dataModel: dataModel.result,
      rulesEngine: rules.result,
      deployment: deployment.result,
    };
  }
}

// ============================================================================
// Example 9: Integration Test
// ============================================================================

/**
 * Full integration test showing the complete flow.
 */
export async function integrationTest() {
  console.log('\n🚀 Starting Integration Test\n');

  try {
    // Initialize
    await setupSpawnSubagent();

    // Run a simple workflow
    const response = await spawnSubagent({
      targetAgent: 'data-model-agent',
      task: 'Test data model design',
      prompt: 'Design a simple data model for testing',
      context: { test: true },
      timeoutMinutes: 1,
    });

    console.log('✓ Test Response:', response);
    console.log('✓ Status:', response.status);
    console.log('✓ Duration:', response.durationSeconds, 'seconds');

    return response;
  } catch (error) {
    console.error('✗ Integration test failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 10: Real-World Project Orchestration
// ============================================================================

/**
 * Complete project orchestration using spawn subagent.
 * This mirrors the ORCHESTRATION_GUIDE.md example.
 */
export async function fullProjectOrchestration() {
  console.log('\n📋 Starting Full Project Orchestration\n');

  const manager = getSpawnSubagentManager();
  const startTime = Date.now();

  try {
    // Phase 1: Requirements (60 min)
    console.log('Phase 1: Gathering Requirements...');
    const requirements = await spawnSubagent({
      targetAgent: 'product-domain-agent',
      task: 'Gather and formalize all requirements',
      prompt: 'Interview directors, review policies, formalize scheduling rules',
      timeoutMinutes: 60,
    });

    console.log('✓ Phase 1 Complete\n');

    // Phase 2: Design (parallel - 30 min each)
    console.log('Phase 2: Design & Architecture (parallel)...');
    const [architecture, dataModel] = await Promise.all([
      spawnSubagent({
        targetAgent: 'solution-architect-agent',
        task: 'Propose system architecture',
        prompt: 'Based on requirements, design the system architecture',
        context: requirements.result,
        timeoutMinutes: 30,
      }),

      spawnSubagent({
        targetAgent: 'data-model-agent',
        task: 'Design data model',
        prompt: 'Design entities, relationships, and validation',
        context: requirements.result,
        timeoutMinutes: 30,
      }),
    ]);

    console.log('✓ Phase 2 Complete\n');

    // Phase 3: Implementation (parallel - 120 min)
    console.log('Phase 3: Implementation (parallel)...');
    const [rulesEngine, uiDesign, deploymentPlan] = await Promise.all([
      spawnSubagent({
        targetAgent: 'rules-engine-agent',
        task: 'Implement compliance rules',
        prompt: 'Build the rules evaluation engine',
        context: { dataModel: dataModel.result, requirements: requirements.result },
        timeoutMinutes: 120,
      }),

      spawnSubagent({
        targetAgent: 'scheduling-ux-agent',
        task: 'Design UI/UX',
        prompt: 'Create UI flows and component specs',
        context: { requirements: requirements.result },
        timeoutMinutes: 120,
      }),

      spawnSubagent({
        targetAgent: 'deployment-ops-agent',
        task: 'Plan deployment',
        prompt: 'Design deployment pipeline and infrastructure',
        context: { architecture: architecture.result },
        timeoutMinutes: 120,
      }),
    ]);

    console.log('✓ Phase 3 Complete\n');

    // Phase 4: Quality Assurance (120 min)
    console.log('Phase 4: Quality Assurance...');
    const testing = await spawnSubagent({
      targetAgent: 'qa-testing-agent',
      task: 'Create comprehensive test suite',
      prompt: 'Build unit, integration, and E2E tests',
      context: {
        requirements: requirements.result,
        architecture: architecture.result,
        dataModel: dataModel.result,
      },
      timeoutMinutes: 120,
    });

    console.log('✓ Phase 4 Complete\n');

    // Phase 5: Launch (parallel - 90 min)
    console.log('Phase 5: Documentation & Launch (parallel)...');
    const [documentation, deployment] = await Promise.all([
      spawnSubagent({
        targetAgent: 'documentation-agent',
        task: 'Generate documentation',
        prompt: 'Create user guides and technical documentation',
        context: { features: architecture.result },
        timeoutMinutes: 90,
      }),

      spawnSubagent({
        targetAgent: 'frontend-engineering-agent',
        task: 'Build UI',
        prompt: 'Implement the scheduling UI',
        context: { design: uiDesign.result, model: dataModel.result },
        timeoutMinutes: 180,
      }),
    ]);

    console.log('✓ Phase 5 Complete\n');

    // Summary
    const totalTime = (Date.now() - startTime) / 1000;
    const metrics = manager.getMetrics();

    console.log('=== 🎉 PROJECT COMPLETE ===\n');
    console.log(`Total Time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`Total Spawns: ${metrics.totalSpawns}`);
    console.log(`Success Rate: ${((metrics.successCount / metrics.totalSpawns) * 100).toFixed(1)}%`);
    console.log(`Average Duration: ${metrics.averageDuration.toFixed(1)}s per task\n`);

    return {
      requirements,
      architecture,
      dataModel,
      rulesEngine,
      uiDesign,
      deploymentPlan,
      testing,
      documentation,
      deployment,
      metrics,
    };
  } catch (error) {
    console.error('Project orchestration failed:', error);
    throw error;
  }
}

// ============================================================================
// Main - Run Examples
// ============================================================================

async function main() {
  try {
    // Initialize the system
    await setupSpawnSubagent();

    // Choose which example to run
    const example = process.env.EXAMPLE || 'integration-test';

    switch (example) {
      case 'basic-setup':
        console.log('Running: Basic Setup');
        break;

      case 'handoff':
        console.log('Running: Simple Handoff');
        await productAgentHandoff();
        break;

      case 'parallel':
        console.log('Running: Parallel Execution');
        await architectSpawnParallel();
        break;

      case 'chained':
        console.log('Running: Chained Execution');
        await chainedExecution();
        break;

      case 'retry':
        console.log('Running: Error Handling with Retry');
        await spawnWithRetry();
        break;

      case 'async':
        console.log('Running: Async Fire-and-Forget');
        await spawnAsyncExample();
        break;

      case 'metrics':
        console.log('Running: Metrics & Monitoring');
        await monitorMetrics();
        break;

      case 'integration-test':
        console.log('Running: Integration Test');
        await integrationTest();
        break;

      case 'full-project':
        console.log('Running: Full Project Orchestration');
        await fullProjectOrchestration();
        break;

      default:
        console.log('Unknown example:', example);
    }

    console.log('\n✓ Example complete');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Uncomment to run:
// main();
