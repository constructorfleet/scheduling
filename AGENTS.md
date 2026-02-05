# Agents and Responsibilities

This project will be executed by a set of focused agents that collaborate with a project manager (you). Each agent owns a clear set of outputs and has defined handoffs.

THERE IS NO AGE PROFILES IN THIS PROJECT! DO NOT ADD THEM! REMOVE ANY REFERENCES TO AGES, AGE_GROUP and AGE_GROUP_PROFILE.

## How to Use These Agents
- Assign tasks by referencing the agent name and expected artifact.
- Each agent should produce concrete outputs (documents, code, tests, or UI artifacts).
- The project manager validates outputs against acceptance criteria before moving on.

## Agent List

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

## Coordination Protocol
- Each agent provides a short status update with artifacts on completion.
- Blockers are raised immediately to the project manager.
- Acceptance criteria are defined in the task brief and signed off before next phase.

## Initial Assignments (Suggested)
1. Product & Domain Agent: gather rules and workflows.
2. Solution Architect Agent: propose tech stack and architecture.
3. Data Model Agent: draft the entity model.

## The schedule
Allow user to enter clock-in and clock-out times.
Allow staff to have multiple non-contiguous working blocks on any given day.

![Schedule Wireframe](<docs/Example Schedule Spreadsheet.png>)

### Configuration
User can add, remove and maintain employees and their properties via the web ui.
User can add, remove and maintain the ratios and certification requirements viat he web ui.
User cannot mark validations as addressed - validations are cleared when the data passes validation.