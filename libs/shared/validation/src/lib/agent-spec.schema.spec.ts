import { describe, it, expect } from 'vitest';
import {
  agentBuilderStateSchema,
  agentCategorySchema,
  agentIterationDiffSchema,
  agentPlanSchema,
  agentSpecSchema,
  dynamicQuestionSchema,
  intentClassificationSchema,
} from './agent-spec.schema.js';

describe('AgentSpec and AI Mode Validation Schemas', () => {
  it('validates a valid IntentClassification', () => {
    const valid = {
      intent: 'create_agent',
      category: 'integration_agent',
      integration: 'GMAIL',
      agentic: true,
      confidence: 0.95,
      reasoning: 'User asked to summarize emails and draft replies',
      suggestedName: 'Gmail Agent',
      suggestedRole: 'Inbox Manager',
    };
    const parsed = intentClassificationSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    expect(agentCategorySchema.safeParse('integration_agent').success).toBe(true);
    expect(agentBuilderStateSchema.safeParse('BUILDING').success).toBe(true);
  });

  it('validates dynamicQuestionSchema with multi-select and recommendations', () => {
    const question = {
      id: 'capabilities',
      label: 'Select Capabilities',
      description: 'Choose what the agent is authorized to do',
      type: 'multi-select',
      options: [
        { label: 'Search', value: 'search', isRecommended: true },
        { label: 'Send', value: 'send' },
      ],
      default: ['search'],
      required: true,
      group: 'Capabilities',
    };
    const parsed = dynamicQuestionSchema.safeParse(question);
    expect(parsed.success).toBe(true);
  });

  it('validates a complete canonical AgentSpec', () => {
    const spec = {
      id: 'spec_123',
      workspaceId: 'ws_abc',
      name: 'Gmail Agent',
      description: 'Manages inbox and prepares replies',
      type: 'agent',
      role: 'Email Specialist',
      category: 'integration_agent',
      instructions: {
        systemPrompt: 'You are an autonomous Gmail assistant.',
        systemInstructions: 'Be professional and concise.',
      },
      model: {
        provider: 'openai',
        model: 'OpenAI GPT-4o',
        temperature: 0.3,
        maxTokens: 4096,
      },
      tools: [
        {
          id: 'gmail_search_emails',
          name: 'gmail_search_emails',
          description: 'Search emails in Gmail',
          category: 'Communication',
          integration: 'GMAIL',
          permissionLevel: 'read',
          requiresConfirmation: false,
          enabled: true,
        },
        {
          id: 'gmail_send_message',
          name: 'gmail_send_message',
          description: 'Send an email',
          category: 'Communication',
          integration: 'GMAIL',
          permissionLevel: 'write',
          requiresConfirmation: true,
          enabled: true,
        },
      ],
      integrations: [
        {
          provider: 'GMAIL',
          status: 'connected',
        },
      ],
      memory: {
        useWorkspaceMemory: true,
        conversationMemory: true,
        userPreferences: true,
      },
      knowledge: {
        knowledgeBaseIds: [],
        retrievalMode: 'HYBRID',
      },
      permissions: {
        role: 'editor',
        toolPolicies: {
          gmail_send_message: { requiresApproval: true },
        },
      },
      guardrails: {
        pii: 'redact',
        maxTokensPerRun: 4000,
      },
      workflows: [
        {
          id: 'wf_1',
          name: 'Triage Workflow',
          trigger: 'chat',
          stepsCount: 3,
        },
      ],
      triggers: [
        {
          type: 'chat',
          config: { mentionHandle: '@Gmail Agent' },
        },
      ],
      ui: {
        icon: 'Mail',
        theme: 'red',
        suggestedPrompts: ['Summarize my unread emails'],
      },
      version: 1,
      status: 'published',
    };

    const parsed = agentSpecSchema.safeParse(spec);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid AgentSpec with missing name or invalid category', () => {
    const invalid = {
      id: 'spec_bad',
      workspaceId: 'ws_1',
      name: '', // Empty name should fail
      type: 'agent',
      category: 'invalid_category_xyz',
    };
    const parsed = agentSpecSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates AgentPlan with dependencies and statuses', () => {
    const plan = {
      overview: 'Test Plan Overview',
      steps: [
        {
          id: 'step-1',
          title: 'Connect Gmail',
          description: 'Check OAuth connection',
          type: 'integration',
          dependencies: [],
          status: 'done',
        },
        {
          id: 'step-2',
          title: 'Register Tools',
          description: 'Bind email tools',
          type: 'tool',
          dependencies: ['step-1'],
          status: 'pending',
        },
      ],
    };
    const parsed = agentPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(true);
  });

  it('validates AgentIterationDiff', () => {
    const diff = {
      userRequest: 'Add automatic PR summaries',
      impactSummary: 'Added 1 workflow and 2 PR tools',
      changes: [
        {
          type: 'added',
          component: 'tool',
          name: 'github_list_pull_requests',
          description: 'Added pull request inspection',
        },
      ],
      appliedSpec: {
        id: 'spec_123',
        workspaceId: 'ws_abc',
        name: 'GitHub Agent',
        type: 'agent',
        role: 'Reviewer',
        category: 'coding_agent',
        instructions: { systemPrompt: 'Review PRs' },
        model: { provider: 'openai', model: 'gpt-4o' },
        tools: [],
        integrations: [],
        memory: {
          useWorkspaceMemory: true,
          conversationMemory: true,
          userPreferences: true,
        },
        knowledge: { knowledgeBaseIds: [] },
        permissions: { role: 'editor', toolPolicies: {} },
        guardrails: {},
        workflows: [],
        triggers: [],
        ui: {},
        version: 2,
        status: 'published',
      },
    };
    const parsed = agentIterationDiffSchema.safeParse(diff);
    expect(parsed.success).toBe(true);
  });
});
