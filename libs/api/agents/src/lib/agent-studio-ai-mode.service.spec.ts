import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentStudioAiModeService } from './agent-studio-ai-mode.service.js';

describe('AgentStudioAiModeService', () => {
  let service: AgentStudioAiModeService;
  let prisma: any;
  let aiInfrastructure: any;

  beforeEach(() => {
    prisma = {
      aIAgent: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'agent_123', name: 'Gmail Agent' }),
        update: vi.fn().mockResolvedValue({ id: 'agent_123', name: 'Gmail Agent' }),
      },
      aIApp: {
        upsert: vi.fn().mockResolvedValue({ id: 'app_123', slug: 'gmail-agent-1234' }),
      },
      externalIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: 'integ_gmail', provider: 'GMAIL', status: 'CONNECTED' }),
      },
      coworkerApp: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    aiInfrastructure = {
      chat: vi.fn().mockRejectedValue(new Error('LLM offline - fallback to heuristic')),
    };

    service = new AgentStudioAiModeService(prisma, aiInfrastructure);
  });

  describe('1. Intent Classification', () => {
    it('accurately classifies a Gmail Agent creation request', async () => {
      const result = await service.classifyIntent(
        'Create a Gmail agent that summarizes my unread emails and drafts replies',
      );
      expect(result.intent).toBe('create_agent');
      expect(result.category).toBe('integration_agent');
      expect(result.integration).toBe('GMAIL');
      expect(result.agentic).toBe(true);
      expect(result.suggestedName).toContain('Gmail');
    });

    it('accurately classifies a GitHub PR agent request', async () => {
      const result = await service.classifyIntent(
        'Create a GitHub agent that monitors pull requests and reviews code',
      );
      expect(result.intent).toBe('create_agent');
      expect(result.category).toBe('coding_agent');
      expect(result.integration).toBe('GITHUB');
      expect(result.agentic).toBe(true);
      expect(result.suggestedName).toContain('GitHub');
    });

    it('classifies sales CRM request', async () => {
      const result = await service.classifyIntent(
        'Create an AI employee for sales that checks CRM leads',
      );
      expect(result.intent).toBe('create_agent');
      expect(result.category).toBe('business_agent');
      expect(result.agentic).toBe(true);
    });
  });

  describe('2. Dynamic Requirements Engine', () => {
    it('generates <= 8 questions with recommended smart defaults for Gmail', async () => {
      const classification = await service.classifyIntent('Create a Gmail agent');
      const { questions, defaultAnswers } = await service.generateRequirements(
        'Create a Gmail agent',
        classification,
      );

      expect(questions.length).toBeLessThanOrEqual(8);
      expect(questions.length).toBeGreaterThan(0);

      // Verify questions contain recommended options
      const capabilityQ = questions.find((q) => q.id === 'gmail_capabilities');
      expect(capabilityQ).toBeDefined();
      expect(capabilityQ?.options?.some((o) => o.isRecommended)).toBe(true);

      // Verify approval gating question exists
      const permQ = questions.find((q) => q.id === 'permission_level');
      expect(permQ).toBeDefined();
      expect(defaultAnswers['permission_level']).toBe('approval_required');
    });

    it('generates appropriate questions for GitHub agent', async () => {
      const classification = await service.classifyIntent('Create a GitHub agent');
      const { questions } = await service.generateRequirements(
        'Create a GitHub agent',
        classification,
      );

      const ghQ = questions.find((q) => q.id === 'github_capabilities');
      expect(ghQ).toBeDefined();
      expect(ghQ?.options?.some((o) => o.value === 'review_prs')).toBe(true);
    });
  });

  describe('3. Agent Plan Synthesis & Compilation', () => {
    it('generates a multi-step plan with dependency chain', async () => {
      const classification = await service.classifyIntent('Create a Gmail agent');
      const plan = await service.generatePlan('Create a Gmail agent', classification, {
        permission_level: 'approval_required',
      });

      expect(plan.steps.length).toBeGreaterThan(3);
      expect(plan.steps[0].type).toBe('integration');
      expect(plan.steps[1].dependencies).toContain(plan.steps[0].id);
    });

    it('compiles a complete canonical AgentSpec with security policies', async () => {
      const classification = await service.classifyIntent('Create a Gmail agent');
      const plan = await service.generatePlan('Create a Gmail agent', classification, {});
      const spec = await service.compileAgentSpec(
        'ws_test',
        'usr_1',
        classification,
        { permission_level: 'approval_required' },
        plan,
      );

      expect(spec.name).toBe('Gmail Agent');
      expect(spec.category).toBe('integration_agent');
      expect(spec.tools.length).toBeGreaterThan(0);
      expect(spec.integrations[0].provider).toBe('GMAIL');
      expect(spec.permissions.toolPolicies['gmail_send_message']?.requiresApproval).toBe(true);
      expect(spec.ui.suggestedPrompts?.length).toBeGreaterThan(0);
    });
  });

  describe('4. Step Execution & Agentic Loop', () => {
    it('executes individual plan steps and emits run events', async () => {
      const classification = await service.classifyIntent('Create a Gmail agent');
      const plan = await service.generatePlan('Create a Gmail agent', classification, {});
      const spec = await service.compileAgentSpec('ws_test', 'usr_1', classification, {}, plan);

      const step = plan.steps[0];
      const result = await service.executePlanStep('ws_test', 'usr_1', step.id, plan, spec);

      expect(result.step.status).toBe('done');
      expect(result.event.type).toBe('step_done');
      expect(result.event.payload['stepId']).toBe(step.id);
    });
  });

  describe('5. Publish to App Registry & Chat', () => {
    it('creates AIAgent, AIApp registry entry, and Matrix bot user', async () => {
      const classification = await service.classifyIntent('Create a Gmail agent');
      const plan = await service.generatePlan('Create a Gmail agent', classification, {});
      const spec = await service.compileAgentSpec('ws_test', 'usr_1', classification, {}, plan);

      const res = await service.publishAgent('ws_test', 'usr_1', spec);

      expect(res.success).toBe(true);
      expect(res.agentId).toBe('agent_123');
      expect(prisma.aIAgent.create).toHaveBeenCalled();
      expect(prisma.aIApp.upsert).toHaveBeenCalled();
    });
  });

  describe('6. Follow-up Iteration Engine', () => {
    it('computes minimal impact diff when user asks for modifications', async () => {
      prisma.aIAgent.findFirst.mockResolvedValueOnce({
        id: 'agent_existing',
        name: 'GitHub Agent',
        role: 'Reviewer',
        systemPrompt: 'Review code',
        provider: 'openai',
        model: 'gpt-4o',
        tools: JSON.stringify(['github_list_repos']),
        configuration: { version: 1, category: 'coding_agent' },
      });

      const diff = await service.iterateAgent(
        'ws_test',
        'usr_1',
        'agent_existing',
        'Add pull request reviews and summaries',
      );

      expect(diff.userRequest).toContain('pull request');
      expect(diff.changes.some((c) => c.component === 'workflow')).toBe(true);
      expect(diff.changes.some((c) => c.component === 'tool')).toBe(true);
      expect(diff.appliedSpec.version).toBe(2);
    });
  });

  describe('7. End-to-End Integration Flow', () => {
    it('runs complete pipeline for Gmail Agent from prompt to publish', async () => {
      // 1. Intake & Intent
      const prompt = 'Create a Gmail agent that summarizes unread emails and drafts replies';
      const classification = await service.classifyIntent(prompt);
      expect(classification.integration).toBe('GMAIL');

      // 2. Dynamic Requirements
      const { questions, defaultAnswers } = await service.generateRequirements(prompt, classification);
      expect(questions.length).toBeGreaterThan(0);

      // 3. Plan Generation
      const plan = await service.generatePlan(prompt, classification, defaultAnswers);
      expect(plan.steps.length).toBeGreaterThan(0);

      // 4. Compile Spec
      const spec = await service.compileAgentSpec('ws_test', 'usr_1', classification, defaultAnswers, plan);
      expect(spec.tools.length).toBeGreaterThan(0);

      // 5. Execute Steps (simulating build loop)
      for (const step of plan.steps) {
        const stepRes = await service.executePlanStep('ws_test', 'usr_1', step.id, plan, spec);
        expect(stepRes.step.status).toBe('done');
      }

      // 6. Publish to App Registry & Chat
      const publishRes = await service.publishAgent('ws_test', 'usr_1', spec);
      expect(publishRes.success).toBe(true);
      expect(publishRes.appSlug).toContain('gmail-agent');
    });

    it('runs complete pipeline for GitHub Agent from prompt to publish', async () => {
      const prompt = 'Create a GitHub agent that reviews pull requests';
      const classification = await service.classifyIntent(prompt);
      expect(classification.integration).toBe('GITHUB');

      const { defaultAnswers } = await service.generateRequirements(prompt, classification);
      const plan = await service.generatePlan(prompt, classification, defaultAnswers);
      const spec = await service.compileAgentSpec('ws_test', 'usr_1', classification, defaultAnswers, plan);

      for (const step of plan.steps) {
        const stepRes = await service.executePlanStep('ws_test', 'usr_1', step.id, plan, spec);
        expect(stepRes.step.status).toBe('done');
      }

      const publishRes = await service.publishAgent('ws_test', 'usr_1', spec);
      expect(publishRes.success).toBe(true);
    });
  });
});
