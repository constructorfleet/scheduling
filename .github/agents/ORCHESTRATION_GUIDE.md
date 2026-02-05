---
name: Project Orchestration Guide
description: How to use spawnSubagent to coordinate agents through a complete project lifecycle
---

# Project Orchestration Guide: Using spawnSubagent

This guide shows how to orchestrate the scheduling project by spawning agents in a coordinated workflow using the `spawnSubagent` tool.

## Quick Start: Spawn an Agent

The simplest way to spawn an agent:

```typescript
const response = await spawnSubagent({
  targetAgent: 'product-domain-agent',
  task: 'Gather compliance requirements',
  prompt: `
    Interview daycare directors about their compliance needs.
    
    Produce a rules catalog with:
    - At least 20 compliance rules
    - Each rule has: title, source, description, test cases, edge cases
    - User stories for core workflows
    - Identified constraint conflicts
    
    Format as structured JSON with rules array and stories array.
  `,
  timeoutMinutes: 60,
});

if (response.status === 'completed') {
  console.log(`✅ Collected ${response.result.rules.length} rules`);
  console.log(`Summary: ${response.summary}`);
} else {
  console.error(`Failed: ${response.errors}`);
}
```

## Orchestration Pattern: Sequential Phases

Organize the project into phases where agents work sequentially:

```typescript
class SchedulingProjectOrchestrator {
  async runFullProject() {
    console.log('🚀 Scheduling App Project - Full Lifecycle\n');
    
    // ======= PHASE 1: DISCOVERY =======
    console.log('📋 PHASE 1: Discovery & Requirements');
    const requirements = await this.phase1_Discovery();
    
    // ======= PHASE 2: DESIGN =======
    console.log('🏗️  PHASE 2: Architecture & Design');
    const design = await this.phase2_Design(requirements);
    
    // ======= PHASE 3: IMPLEMENTATION =======
    console.log('⚙️  PHASE 3: Implementation (Parallel)');
    const implementation = await this.phase3_Implementation(design);
    
    // ======= PHASE 4: QUALITY =======
    console.log('🧪 PHASE 4: Testing & Quality Assurance');
    const testing = await this.phase4_Quality(implementation);
    
    // ======= PHASE 5: LAUNCH =======
    console.log('📚 PHASE 5: Documentation & Deployment');
    const launch = await this.phase5_Launch(implementation, testing);
    
    console.log('\n🎉 Project Complete!');
    return { requirements, design, implementation, testing, launch };
  }

  // ======= PHASE 1: DISCOVERY =======
  async phase1_Discovery() {
    console.log('\n  1.1 Gathering Compliance Requirements...');
    
    const rulesResponse = await spawnSubagent({
      targetAgent: 'product-domain-agent',
      task: 'Formalize Compliance Rules',
      prompt: `
        You are gathering requirements for a daycare scheduling system.
        
        Your mission:
        1. Research and list compliance requirements
           - Staffing: ratios and requirements
        
        2. Document staffing rules
           - Break requirements
           - Maximum shift lengths
           - Certification expiry and renewal
           - Qualification requirements
        
        3. Create user stories for core workflows
           - Create a weekly schedule
           - Handle violations
           - Copy and modify templates
           - Manage staff availability
        
        4. Identify edge cases and conflicts
           - What happens when multiple rules conflict?
           - How to handle partial compliance?
        
        Return as structured JSON:
        {
          rules: Array<Rule>,
          userStories: Array<UserStory>,
          edgeCases: Array<string>,
          conflicts: Array<string>,
          summary: string
        }
      `,
      expectedOutputFormat: `
        {
          rules: Array<{
            id: string;
            title: string;
            source: string;
            description: string;
            testCases: Array<string>;
            edgeCases: Array<string>;
          }>;
          userStories: Array<{
            title: string;
            acceptanceCriteria: Array<string>;
            priority: 'P0' | 'P1' | 'P2';
          }>;
          edgeCases: Array<string>;
          conflicts: Array<string>;
          summary: string;
        }
      `,
      timeoutMinutes: 60,
    });

    if (rulesResponse.status !== 'completed') {
      throw new Error(`Phase 1 failed: ${rulesResponse.errors}`);
    }

    console.log(`  ✅ Discovered ${rulesResponse.result.rules.length} compliance rules`);
    console.log(`  ✅ Defined ${rulesResponse.result.userStories.length} user stories`);
    console.log(`  ✅ Identified ${rulesResponse.result.edgeCases.length} edge cases`);
    
    return rulesResponse.result;
  }

  // ======= PHASE 2: DESIGN =======
  async phase2_Design(requirements) {
    console.log('\n  2.1 Designing System Architecture...');
    console.log('  2.2 Designing Data Model...');
    
    // Spawn architecture and data model agents in parallel
    const [archResponse, dataResponse] = await Promise.all([
      spawnSubagent({
        targetAgent: 'solution-architect-agent',
        task: 'Design System Architecture',
        context: { requirements },
        prompt: `
          Based on these compliance requirements, design the system architecture.
          
          Decisions needed:
          1. UI Framework (React, Vue, Svelte, or vanilla)
          2. State management approach
          3. Persistence layer (IndexedDB, LocalStorage, etc.)
          4. Rules engine design
          5. Module boundaries
          
          Consider:
          - Standalone HTML5 deployment (no server required for MVP)
          - Offline-first operation
          - Future extensibility
          - Performance for 100+ staff
          
          Return as structured JSON with:
          {
            framework: string;
            stateManagement: string;
            persistence: string;
            modules: Array<ModuleSpec>;
            rationale: string;
          }
        `,
        timeoutMinutes: 30,
      }),
      
      spawnSubagent({
        targetAgent: 'data-model-agent',
        task: 'Design Data Model',
        context: { requirements },
        prompt: `
          Based on these compliance requirements, design the core data model.
          
          Entities to model:
          1. Staff (with certifications, availability)
          2. Schedules (weekly assignments)
          3. Certifications (with expiry dates)
          4. Violations (compliance issues)
          5. Audit trail (change history)
          
          For each entity, specify:
          - Attributes and types
          - Required constraints
          - Relationships to other entities
          - Queries needed
          
          Return as structured JSON with entity definitions.
        `,
        timeoutMinutes: 30,
      }),
    ]);

    if (archResponse.status !== 'completed' || dataResponse.status !== 'completed') {
      throw new Error('Phase 2 failed');
    }

    console.log('  ✅ Architecture designed');
    console.log('  ✅ Data model defined');
    
    return {
      architecture: archResponse.result,
      dataModel: dataResponse.result,
    };
  }

  // ======= PHASE 3: IMPLEMENTATION =======
  async phase3_Implementation(design) {
    console.log('\n  3.1 Implementing Rules Engine...');
    console.log('  3.2 Building Scheduling UI...');
    console.log('  3.3 Setting up Deployment Pipeline...');
    
    // Three major components built in parallel
    const [rulesResponse, uiResponse, opsResponse] = await Promise.all([
      spawnSubagent({
        targetAgent: 'rules-engine-agent',
        task: 'Implement Compliance Rules Engine',
        context: { design },
        prompt: `
          Implement a comprehensive rules engine for compliance checking.
          
          Requirements:
          1. Implement all ratio rules
             - Standard: 1:3
             - Toddler: 1:4
             - Preschool: 1:8
          
          2. Implement certification rules
             - Lead presence required
             - CPR current required
          
          3. Implement capacity rules
             - Don't exceed max enrollment
          
          4. Implement break and shift rules
             - Max 8 hour shifts
             - Break requirements
          
          Return:
          - TypeScript implementations of all rules
          - Unit tests for each rule
          - Integration tests
          - Coverage report (target: 100%)
        `,
        timeoutMinutes: 60,
      }),

      spawnSubagent({
        targetAgent: 'scheduling-ux-agent',
        task: 'Design Scheduling UI Flows',
        context: { design },
        prompt: `
          Design the complete UI for the scheduling app.
          
          Core workflows to design:
          1. Create new weekly schedule
          2. Assign staff to days/times
          3. View and resolve violations
          4. Copy and modify templates
          5. Manage staff availability
          6. Review and lock schedule
          
          For each workflow:
          - Create wireframes
          - Map user interactions
          - Define error cases
          - Specify components needed
          
          Then spawn the Frontend Engineering Agent to implement.
        `,
        timeoutMinutes: 45,
      }),

      spawnSubagent({
        targetAgent: 'deployment-ops-agent',
        task: 'Design Build & Deployment Pipeline',
        context: { design },
        prompt: `
          Design the CI/CD pipeline for the scheduling app.
          
          Pipeline should:
          1. Run linting and type checks
          2. Run unit tests (target: 100% coverage)
          3. Run integration tests
          4. Build production bundle
          5. Deploy to staging
          6. Run smoke tests
          7. Deploy to production
          8. Monitor and alert
          
          Configuration needed:
          - GitHub Actions workflow
          - AWS S3 + CloudFront for static hosting
          - Docker image (for on-premise deployment)
          - Monitoring and alerting setup
        `,
        timeoutMinutes: 45,
      }),
    ]);

    if (rulesResponse.status !== 'completed' || 
        uiResponse.status !== 'completed' || 
        opsResponse.status !== 'completed') {
      throw new Error('Phase 3 failed');
    }

    // After UX design, spawn frontend to build the UI
    console.log('  3.2b Implementing UI Components...');
    const frontendResponse = await spawnSubagent({
      targetAgent: 'frontend-engineering-agent',
      task: 'Implement Scheduling UI',
      context: {
        design,
        uiSpecification: uiResponse.result,
        rulesEngine: rulesResponse.result,
      },
      prompt: `
        Build the complete scheduling UI based on the UX design.
        
        Requirements:
        1. Implement schedule grid component
        2. Implement staff picker
        3. Implement violations panel
        4. Implement review/lock workflow
        5. Implement state management
        6. Integrate with rules engine
        7. Support offline-first operation
        
        Acceptance criteria:
        - All core workflows work end-to-end
        - Compliant schedules can be created
        - Violations are clearly displayed
        - UI works on desktop and tablet
        - Keyboard accessible
        - 80%+ code coverage
      `,
      timeoutMinutes: 120,
    });

    console.log('  ✅ Rules engine implemented');
    console.log('  ✅ UI components built');
    console.log('  ✅ Deployment pipeline configured');
    
    return {
      rulesEngine: rulesResponse.result,
      uiDesign: uiResponse.result,
      frontend: frontendResponse.result,
      deployment: opsResponse.result,
    };
  }

  // ======= PHASE 4: QUALITY =======
  async phase4_Quality(implementation) {
    console.log('\n  4.1 Creating Test Suite...');
    
    const testingResponse = await spawnSubagent({
      targetAgent: 'qa-testing-agent',
      task: 'Create Comprehensive Test Suite',
      context: { implementation },
      prompt: `
        Create a comprehensive test suite for the scheduling app.
        
        Test requirements:
        1. Unit tests for all rules (100% coverage)
        2. Unit tests for data model (95%+ coverage)
        3. Integration tests (all major workflows)
        4. E2E tests (Cypress/Playwright)
        5. Test data and fixtures
        6. Performance tests
        7. Accessibility tests
        
        Workflows to test:
        - Create schedule from scratch
        - Assign staff and resolve violations
        - Copy and modify template
        - Lock and publish schedule
        - Handle edge cases
        
        Acceptance criteria:
        - All tests passing
        - 90%+ code coverage
        - Critical paths 100% covered
        - Performance: schedule render < 2s
        - No accessibility violations
      `,
      timeoutMinutes: 120,
    });

    if (testingResponse.status !== 'completed') {
      throw new Error('Phase 4 failed');
    }

    console.log('  ✅ Test suite created');
    console.log(`  ✅ ${testingResponse.result.testCount || '100+'} tests passing`);
    
    return testingResponse.result;
  }

  // ======= PHASE 5: LAUNCH =======
  async phase5_Launch(implementation, testing) {
    console.log('\n  5.1 Creating User Documentation...');
    
    const [docsResponse] = await Promise.all([
      spawnSubagent({
        targetAgent: 'documentation-agent',
        task: 'Create User & Technical Documentation',
        context: { implementation, testing },
        prompt: `
          Create comprehensive documentation for the scheduling app.
          
          User Guide:
          - Getting started (5 min)
          - Create a schedule (step-by-step with screenshots)
          - Handle violations and resolve conflicts
          - Manage staff and availability
          - Copy and modify schedules
          - FAQ and troubleshooting
          
          Technical Documentation:
          - Architecture overview
          - Module reference
          - Data model
          - Rules catalog
          - API reference
          - Deployment guide
          
          Quick Reference:
          - One-page task checklists
          - Keyboard shortcuts
          - Error messages and solutions
          
          Videos:
          - Storyboards for key workflows
          - Narration outline
        `,
        timeoutMinutes: 90,
      }),
    ]);

    if (docsResponse.status !== 'completed') {
      throw new Error('Phase 5 failed');
    }

    console.log('  ✅ Documentation complete');
    console.log('  ✅ Ready for production deployment');
    
    return docsResponse.result;
  }
}

// Run the full orchestration
const orchestrator = new SchedulingProjectOrchestrator();
await orchestrator.runFullProject();
```

## Pattern: Parallel Execution

When work is independent, spawn multiple agents at the same time:

```typescript
// Bad: Sequential (slow)
const arch = await spawnSubagent({ /* architecture */ });
const data = await spawnSubagent({ /* data model */ });
const rules = await spawnSubagent({ /* rules */ });
// Total time: ~90 minutes

// Good: Parallel (fast)
const [arch, data, rules] = await Promise.all([
  spawnSubagent({ /* architecture */ }),
  spawnSubagent({ /* data model */ }),
  spawnSubagent({ /* rules */ }),
]);
// Total time: ~30 minutes
```

## Pattern: Passing Context Between Agents

Pass the output of one agent as input to the next:

```typescript
// Step 1: Product agent discovers requirements
const requirements = await spawnSubagent({
  targetAgent: 'product-domain-agent',
  task: 'Discover requirements',
  prompt: '...',
});

// Step 2: Architect uses requirements
const architecture = await spawnSubagent({
  targetAgent: 'solution-architect-agent',
  task: 'Design architecture',
  context: { 
    requirements: requirements.result  // Pass result as context
  },
  prompt: `Based on these requirements: ${JSON.stringify(requirements.result, null, 2)}`,
});

// Step 3: Multiple agents use architecture
const [dataModel, rulesEngine] = await Promise.all([
  spawnSubagent({
    targetAgent: 'data-model-agent',
    context: { architecture: architecture.result },
    prompt: '...',
  }),
  spawnSubagent({
    targetAgent: 'rules-engine-agent',
    context: { architecture: architecture.result },
    prompt: '...',
  }),
]);
```

## Pattern: Error Handling & Retry

Handle failures gracefully:

```typescript
async function spawnWithRetry(request, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await spawnSubagent(request);
    
    if (response.status === 'completed') {
      return response;
    }
    
    console.warn(`Attempt ${attempt} failed: ${response.errors}`);
    
    if (attempt < maxRetries) {
      // Increase timeout and retry
      request.timeoutMinutes = (request.timeoutMinutes || 30) * 2;
      await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
const result = await spawnWithRetry({
  targetAgent: 'rules-engine-agent',
  task: 'Implement rules',
  prompt: '...',
});
```

## Pattern: Monitoring & Reporting

Track agent execution for reporting:

```typescript
class ProjectMetrics {
  executions: Array<{
    agent: string;
    task: string;
    status: string;
    duration: number;
    completedAt: string;
  }> = [];

  async executeAndTrack(request) {
    const startTime = Date.now();
    const response = await spawnSubagent(request);
    const duration = Date.now() - startTime;
    
    this.executions.push({
      agent: request.targetAgent,
      task: request.task,
      status: response.status,
      duration,
      completedAt: new Date().toISOString(),
    });
    
    return response;
  }

  generateReport() {
    const total = this.executions.length;
    const completed = this.executions.filter(e => e.status === 'completed').length;
    const avgDuration = this.executions.reduce((sum, e) => sum + e.duration, 0) / total;
    
    console.log(`\n📊 Project Metrics`);
    console.log(`   Agents Executed: ${total}`);
    console.log(`   Success Rate: ${(completed/total*100).toFixed(1)}%`);
    console.log(`   Avg Duration: ${(avgDuration/1000/60).toFixed(1)} min`);
    console.log(`   Total Time: ${(this.executions.reduce((sum, e) => sum + e.duration, 0) / 1000 / 60).toFixed(1)} min`);
  }
}
```

## Best Practices Summary

1. **Be Specific**: Give agents detailed prompts with examples
2. **Pass Context**: Include relevant prior work and requirements
3. **Handle Errors**: Always check response.status and handle failures
4. **Parallelize**: Spawn independent agents at the same time
5. **Chain Logically**: Use output of one agent as input to the next
6. **Set Timeouts**: Longer tasks need more time (60-120 min)
7. **Track Metrics**: Monitor execution time and success rates
8. **Provide Feedback**: Let agents know what you're looking for in expected output format

## Quick Reference: Common Handoffs

| From | To | When | What to Pass |
|------|----|----|-----|
| Product | Architect | Requirements finalized | Rules catalog, user stories |
| Architect | Data Model | Architecture decided | Module boundaries, constraints |
| Architect | Rules Engine | Tech stack chosen | Architecture doc, module specs |
| Data Model | Rules Engine | Schema defined | Entity definitions, relationships |
| Data Model | Frontend | Schema ready | Entity/attribute list |
| Rules Engine | QA | All rules implemented | Rule definitions, test cases |
| UX | Frontend | Designs finalized | Wireframes, component specs, flows |
| Frontend | QA | UI complete | Component code, state structure |
| QA | Documentation | Tests passing | Test results, coverage report |
| Documentation | Deployment | Docs complete | User guides, technical docs |
| Deployment | QA | Pipeline ready | Build/deploy scripts, config |
