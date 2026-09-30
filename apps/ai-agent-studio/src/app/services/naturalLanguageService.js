// Natural Language Builder & Conversational Workflow Assistant Simulation

export const naturalLanguageService = {
  async generateWorkflowFromPrompt(prompt) {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const lower = prompt.toLowerCase();

    if (lower.includes('research') || lower.includes('crawl') || lower.includes('competitor') || lower.includes('scrape')) {
      return {
        agentName: 'Automated Market Researcher',
        role: 'Web Intelligence Specialist',
        description: 'Autonomously crawls websites with Firecrawl, parses pricing tables, and dispatches formatted briefs.',
        model: 'claude-3-5-sonnet',
        nodes: [
          {
            id: 'trigger-1',
            type: 'START',
            position: { x: 80, y: 180 },
            data: { label: 'Daily Schedule Trigger', subtitle: 'Runs every morning at 08:00', config: { cron: '0 8 * * *' } },
          },
          {
            id: 'firecrawl-1',
            type: 'FIRECRAWL_SEARCH',
            position: { x: 380, y: 180 },
            data: { label: 'Firecrawl Web Crawler', subtitle: 'Extracts competitor change logs', config: { query: prompt } },
          },
          {
            id: 'agent-1',
            type: 'AGENT',
            position: { x: 720, y: 180 },
            data: { label: 'Analyze & Summarize', subtitle: 'claude-3-5-sonnet', config: { model: 'claude-3-5-sonnet' } },
          },
          {
            id: 'slack-1',
            type: 'TOOL',
            position: { x: 1040, y: 180 },
            data: { label: 'Post to Slack', subtitle: '#intel-updates', config: { channel: '#intel-updates' } },
          },
          {
            id: 'end-1',
            type: 'END',
            position: { x: 1320, y: 180 },
            data: { label: 'Workflow Output', subtitle: 'Save brief report' },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'trigger-1', target: 'firecrawl-1' },
          { id: 'e2-3', source: 'firecrawl-1', target: 'agent-1' },
          { id: 'e3-4', source: 'agent-1', target: 'slack-1' },
          { id: 'e4-5', source: 'slack-1', target: 'end-1' },
        ],
        summary: 'Generated a 5-node automated research workflow with Firecrawl crawl and Slack alert dispatching.',
      };
    }

    if (lower.includes('support') || lower.includes('customer') || lower.includes('refund') || lower.includes('ticket')) {
      return {
        agentName: 'Customer Support & Refund Concierge',
        role: 'Tier-1 Customer Specialist',
        description: 'Resolves inbound customer inquiries with RAG and human approval checkpoints.',
        model: 'gpt-4o',
        nodes: [
          {
            id: 'trigger-1',
            type: 'START',
            position: { x: 80, y: 200 },
            data: { label: 'Chat Inbound Trigger', subtitle: 'Customer message received', config: { channel: 'widget' } },
          },
          {
            id: 'kb-1',
            type: 'KB_SEARCH',
            position: { x: 380, y: 140 },
            data: { label: 'Search Support KB', subtitle: 'Top-4 semantic matches', config: { topK: 4 } },
          },
          {
            id: 'approval-1',
            type: 'USER_APPROVAL',
            position: { x: 380, y: 280 },
            data: { label: 'Refund Supervisor Approval', subtitle: 'Sign-off on transactions', config: { approverRole: 'Finance Admin' } },
          },
          {
            id: 'agent-1',
            type: 'AGENT',
            position: { x: 740, y: 200 },
            data: { label: 'Synthesize Resolution', subtitle: 'gpt-4o with citations', config: { model: 'gpt-4o' } },
          },
          {
            id: 'end-1',
            type: 'END',
            position: { x: 1080, y: 200 },
            data: { label: 'Send Answer to User', subtitle: 'Stream response' },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'trigger-1', target: 'kb-1' },
          { id: 'e1-3', source: 'trigger-1', target: 'approval-1' },
          { id: 'e2-4', source: 'kb-1', target: 'agent-1' },
          { id: 'e3-4', source: 'approval-1', target: 'agent-1' },
          { id: 'e4-5', source: 'agent-1', target: 'end-1' },
        ],
        summary: 'Generated an enterprise customer support pipeline with Knowledge Base search and Human Approval branch.',
      };
    }

    // Default multi-step flow
    return {
      agentName: 'Intelligent Automation Agent',
      role: 'Autonomous Operations Specialist',
      description: `Workflow custom generated from user prompt: "${prompt}"`,
      model: 'gpt-4o',
      nodes: [
        {
          id: 'trigger-1',
          type: 'START',
          position: { x: 80, y: 180 },
          data: { label: 'Workflow Trigger', subtitle: 'Manual or API execution', config: { triggerType: 'MANUAL' } },
        },
        {
          id: 'agent-1',
          type: 'AGENT',
          position: { x: 420, y: 180 },
          data: { label: 'Core AI Reasoner', subtitle: 'gpt-4o', config: { model: 'gpt-4o', systemPrompt: prompt } },
        },
        {
          id: 'end-1',
          type: 'END',
          position: { x: 760, y: 180 },
          data: { label: 'Workflow Completion', subtitle: 'Delivers result' },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'trigger-1', target: 'agent-1', animated: true },
        { id: 'e2-3', source: 'agent-1', target: 'end-1' },
      ],
      summary: `Generated standard workflow structure tailored for: "${prompt.slice(0, 60)}..."`,
    };
  },

  async applyConversationalEdit(nodes, edges, instruction) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const lower = instruction.toLowerCase();

    // Check if adding approval
    if (lower.includes('approval') || lower.includes('human') || lower.includes('review')) {
      const newNodeId = `approval-${Date.now().toString(36)}`;
      const lastNode = nodes[nodes.length - 1];
      const newNode = {
        id: newNodeId,
        type: 'USER_APPROVAL',
        position: { x: (lastNode?.position?.x || 500) + 160, y: (lastNode?.position?.y || 200) + 50 },
        data: {
          label: 'Human Review Checkpoint',
          subtitle: 'Pause for supervisor sign-off',
          config: { approverRole: 'Admin' },
        },
      };

      return {
        explanation: 'Added a Human Approval Checkpoint node to pause execution before final delivery.',
        diff: {
          addedNodes: [newNode],
          modifiedNodes: [],
          deletedNodeIds: [],
        },
      };
    }

    // Check if adding search or knowledge
    if (lower.includes('search') || lower.includes('knowledge') || lower.includes('rag')) {
      const newNodeId = `kb-${Date.now().toString(36)}`;
      const newNode = {
        id: newNodeId,
        type: 'KB_SEARCH',
        position: { x: 380, y: 80 },
        data: {
          label: 'Knowledge Retrieval',
          subtitle: 'Search support documentation',
          config: { topK: 4 },
        },
      };

      return {
        explanation: 'Inserted Knowledge Base Search node into the workflow.',
        diff: {
          addedNodes: [newNode],
          modifiedNodes: [],
          deletedNodeIds: [],
        },
      };
    }

    // Default: modify prompt or parameters
    return {
      explanation: `Analyzed instruction: "${instruction}". Recommended optimizing temperature to 0.2 and adding error fallback branches.`,
      diff: {
        addedNodes: [],
        modifiedNodes: nodes.slice(0, 1).map((n) => ({
          ...n,
          data: {
            ...n.data,
            subtitle: 'Updated with AI suggestions',
          },
        })),
        deletedNodeIds: [],
      },
    };
  },
};
