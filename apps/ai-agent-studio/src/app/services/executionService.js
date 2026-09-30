import { storage } from './storage.js';
import { INITIAL_EXECUTIONS } from './mockData.js';

const STORAGE_KEY = 'executions_history';

function loadExecutions() {
  const cached = storage.get(STORAGE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  storage.set(STORAGE_KEY, INITIAL_EXECUTIONS);
  return INITIAL_EXECUTIONS;
}

export const executionService = {
  async getExecutions(filters = {}) {
    let list = loadExecutions();
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((e) => e.status === filters.status);
    }
    if (filters.agentId) {
      list = list.filter((e) => e.agentId === filters.agentId);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.agentName.toLowerCase().includes(q) ||
          e.workflowName.toLowerCase().includes(q) ||
          (e.promptText && e.promptText.toLowerCase().includes(q)),
      );
    }
    return list;
  },

  async getExecutionById(id) {
    const list = loadExecutions();
    const found = list.find((e) => e.id === id);
    if (!found) throw new Error('Execution not found');
    return found;
  },

  async runWorkflowSimulation(agent, inputPrompt = '', onStepUpdate = null) {
    const list = loadExecutions();
    const execId = `exec-${Math.floor(1000 + Math.random() * 9000)}`;

    const steps = [
      { id: 'step-1', nodeName: 'Workflow Trigger', status: 'RUNNING', durationMs: 0 },
      { id: 'step-2', nodeName: 'Intent Classifier', status: 'IDLE', durationMs: 0 },
      { id: 'step-3', nodeName: 'Search Knowledge Base', status: 'IDLE', durationMs: 0 },
      { id: 'step-4', nodeName: 'AI Agent Reasoning', status: 'IDLE', durationMs: 0 },
      { id: 'step-5', nodeName: 'Workflow Output', status: 'IDLE', durationMs: 0 },
    ];

    const newExec = {
      id: execId,
      agentId: agent.id,
      agentName: agent.name,
      workflowName: `${agent.name} Live Run`,
      trigger: 'MANUAL',
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      tokensUsed: 0,
      costEstimated: '$0.00',
      promptText: inputPrompt || 'Interactive workflow test executed from Studio builder.',
      steps,
    };

    if (onStepUpdate) onStepUpdate({ ...newExec });

    // Step 1: Trigger
    await new Promise((r) => setTimeout(r, 400));
    steps[0].status = 'SUCCESS';
    steps[0].durationMs = 35;
    steps[0].output = { input: inputPrompt };
    steps[1].status = 'RUNNING';
    if (onStepUpdate) onStepUpdate({ ...newExec, steps: [...steps] });

    // Step 2: Classifier
    await new Promise((r) => setTimeout(r, 600));
    steps[1].status = 'SUCCESS';
    steps[1].durationMs = 180;
    steps[1].output = { category: 'Technical Support', confidence: 0.98 };
    steps[2].status = 'RUNNING';
    if (onStepUpdate) onStepUpdate({ ...newExec, steps: [...steps] });

    // Step 3: KB Search
    await new Promise((r) => setTimeout(r, 700));
    steps[2].status = 'SUCCESS';
    steps[2].durationMs = 290;
    steps[2].output = { retrievedArticles: 2, topArticle: 'Enterprise SAML/SSO Guide' };
    steps[3].status = 'RUNNING';
    if (onStepUpdate) onStepUpdate({ ...newExec, steps: [...steps] });

    // Step 4: AI Reasoning
    await new Promise((r) => setTimeout(r, 900));
    steps[3].status = 'SUCCESS';
    steps[3].durationMs = 620;
    steps[3].output = {
      text: `Resolution generated for: "${inputPrompt || 'General Query'}" based on indexed enterprise documentation.`,
    };
    steps[4].status = 'RUNNING';
    if (onStepUpdate) onStepUpdate({ ...newExec, steps: [...steps] });

    // Step 5: Output
    await new Promise((r) => setTimeout(r, 300));
    steps[4].status = 'SUCCESS';
    steps[4].durationMs = 45;
    steps[4].output = { delivered: true, channel: 'chat_stream' };

    newExec.status = 'SUCCESS';
    newExec.completedAt = new Date().toISOString();
    newExec.durationMs = 1170;
    newExec.tokensUsed = 1380;
    newExec.costEstimated = '$0.0104';
    newExec.resultSummary = `Successfully resolved task: "${inputPrompt || 'General test'}" in 5 steps.`;

    const updatedList = [newExec, ...list];
    storage.set(STORAGE_KEY, updatedList);

    if (onStepUpdate) onStepUpdate(newExec);
    return newExec;
  },

  async retryExecution(id) {
    const list = loadExecutions();
    const target = list.find((e) => e.id === id);
    if (!target) throw new Error('Execution not found');

    const retried = {
      ...target,
      id: `exec-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      resultSummary: 'Retry succeeded after transient failure recovery.',
    };
    storage.set(STORAGE_KEY, [retried, ...list]);
    return retried;
  },
};
