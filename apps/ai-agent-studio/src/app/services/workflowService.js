// Visual workflow graph validation, auto-layout and execution simulation

export const workflowService = {
  validateGraph(nodes = [], edges = []) {
    const issues = [];

    if (nodes.length === 0) {
      issues.push({
        severity: 'ERROR',
        title: 'Empty Canvas',
        message: 'The workflow has no nodes. Drag and drop at least a Trigger node to begin.',
      });
      return { valid: false, issues };
    }

    // Check Trigger
    const hasTrigger = nodes.some(
      (n) => n.type === 'START' || n.type === 'TRIGGER' || (n.type && n.type.startsWith('TRIGGER_')),
    );
    if (!hasTrigger) {
      issues.push({
        severity: 'WARNING',
        title: 'Missing Trigger Node',
        message: 'No Trigger or Start node was detected. The workflow cannot be launched automatically.',
      });
    }

    // Check Output
    const hasOutput = nodes.some(
      (n) => n.type === 'END' || n.type === 'OUTPUT' || (n.type && n.type.includes('OUTPUT')),
    );
    if (!hasOutput) {
      issues.push({
        severity: 'INFO',
        title: 'No Output Node',
        message: 'Add an End or Output node to explicitly define the final result delivery structure.',
      });
    }

    // Check Disconnected Nodes
    const connectedNodeIds = new Set();
    edges.forEach((e) => {
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    });

    nodes.forEach((n) => {
      if (nodes.length > 1 && !connectedNodeIds.has(n.id)) {
        issues.push({
          severity: 'WARNING',
          nodeId: n.id,
          title: `Disconnected Node: "${n.data?.label || n.id}"`,
          message: 'This node is not connected to any other node and will be skipped during execution.',
        });
      }
    });

    const hasErrors = issues.some((i) => i.severity === 'ERROR');
    return {
      valid: !hasErrors,
      errorCount: issues.filter((i) => i.severity === 'ERROR').length,
      warningCount: issues.filter((i) => i.severity === 'WARNING').length,
      infoCount: issues.filter((i) => i.severity === 'INFO').length,
      issues,
    };
  },

  autoLayout(nodes = [], edges = [], direction = 'LR') {
    if (!nodes || nodes.length === 0) {
      const empty = Object.assign([], { nodes: [], edges: [] });
      return empty;
    }

    // Node dimensions & spacing constants
    const nodeWidth = 260;
    const nodeHeight = 110;
    const horizontalGap = direction === 'LR' ? 100 : 80;
    const verticalGap = direction === 'LR' ? 70 : 100;
    const colWidth = nodeWidth + horizontalGap; // 360px
    const rowHeight = nodeHeight + verticalGap; // 180px

    const startX = 80;
    const startY = 160;

    // Separate Sticky Notes and Group Nodes so they don't break graph layering
    const flowNodes = [];
    const stickyNotes = [];
    const groupNodes = [];

    nodes.forEach((n) => {
      const type = (n.type || '').toUpperCase();
      if (type.includes('NOTE') || type.includes('STICKY')) {
        stickyNotes.push(n);
      } else if (type.includes('GROUP') || type.includes('FRAME')) {
        groupNodes.push(n);
      } else {
        flowNodes.push(n);
      }
    });

    const nodeIds = new Set(flowNodes.map((n) => n.id));
    const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    // Adjacency map and incoming edges
    const outEdges = new Map();
    const inEdges = new Map();
    flowNodes.forEach((n) => {
      outEdges.set(n.id, []);
      inEdges.set(n.id, []);
    });

    validEdges.forEach((e) => {
      outEdges.get(e.source)?.push(e.target);
      inEdges.get(e.target)?.push(e.source);
    });

    // Cycle detection & feedback arc removal via DFS
    const visited = new Set();
    const recursionStack = new Set();
    const forwardEdges = new Map();
    flowNodes.forEach((n) => forwardEdges.set(n.id, []));

    function dfs(u) {
      visited.add(u);
      recursionStack.add(u);
      const targets = outEdges.get(u) || [];
      for (const v of targets) {
        if (!visited.has(v)) {
          forwardEdges.get(u).push(v);
          dfs(v);
        } else if (!recursionStack.has(v)) {
          // Cross or forward edge - keep it
          forwardEdges.get(u).push(v);
        }
        // If recursionStack.has(v), it's a back-edge (cycle); ignore for layering
      }
      recursionStack.delete(u);
    }

    // Start DFS from nodes that look like triggers or have 0 in-degree
    const roots = flowNodes.filter((n) => {
      const type = (n.type || '').toUpperCase();
      return inEdges.get(n.id)?.length === 0 || type.includes('START') || type.includes('TRIGGER');
    });

    roots.forEach((r) => {
      if (!visited.has(r.id)) dfs(r.id);
    });
    // Traverse any remaining unvisited nodes
    flowNodes.forEach((n) => {
      if (!visited.has(n.id)) dfs(n.id);
    });

    // Assign Longest-Path Layer Ranks
    const ranks = new Map();
    roots.forEach((r) => ranks.set(r.id, 0));

    // Topological relaxation for longest-path
    let changed = true;
    let iterations = 0;
    while (changed && iterations < flowNodes.length * 2) {
      changed = false;
      iterations++;
      for (const [u, targets] of forwardEdges.entries()) {
        const uRank = ranks.get(u) || 0;
        for (const v of targets) {
          const vRank = ranks.get(v) || 0;
          if (vRank < uRank + 1) {
            ranks.set(v, uRank + 1);
            changed = true;
          }
        }
      }
    }

    // Group flow nodes into layers
    const layers = new Map();
    flowNodes.forEach((n) => {
      const r = ranks.get(n.id) || 0;
      if (!layers.has(r)) layers.set(r, []);
      layers.get(r).push(n);
    });

    const maxRank = Math.max(0, ...Array.from(layers.keys()));

    // Barycenter heuristic sorting per layer to minimize edge crossings
    for (let r = 1; r <= maxRank; r++) {
      const layerNodes = layers.get(r) || [];
      layerNodes.sort((a, b) => {
        const aParents = inEdges.get(a.id) || [];
        const bParents = inEdges.get(b.id) || [];
        const aAvg = aParents.length
          ? aParents.reduce((sum, p) => sum + (ranks.get(p) || 0), 0) / aParents.length
          : 0;
        const bAvg = bParents.length
          ? bParents.reduce((sum, p) => sum + (ranks.get(p) || 0), 0) / bParents.length
          : 0;
        return aAvg - bAvg;
      });
    }

    // Calculate maximum layer height for centering
    let maxLayerCount = 1;
    layers.forEach((nodesInLayer) => {
      if (nodesInLayer.length > maxLayerCount) {
        maxLayerCount = nodesInLayer.length;
      }
    });

    const centerY = startY + ((maxLayerCount - 1) * rowHeight) / 2;

    // Assign positions to flow nodes
    const positionedFlowNodes = [];
    layers.forEach((nodesInLayer, layerIndex) => {
      const layerHeight = (nodesInLayer.length - 1) * rowHeight;
      const layerStartY = Math.max(80, centerY - layerHeight / 2);

      nodesInLayer.forEach((node, nodeIndex) => {
        let x, y;
        if (direction === 'LR') {
          x = startX + layerIndex * colWidth;
          y = layerStartY + nodeIndex * rowHeight;
        } else {
          // Top to Bottom
          x = startX + nodeIndex * colWidth;
          y = startY + layerIndex * rowHeight;
        }

        positionedFlowNodes.push({
          ...node,
          position: { x: Math.round(x), y: Math.round(y) },
        });
      });
    });

    // Position Sticky Notes above the main flow
    const positionedStickyNotes = stickyNotes.map((note, idx) => ({
      ...note,
      position: {
        x: startX + idx * 260,
        y: 40,
      },
    }));

    // Position Group Frames to sit neatly below
    const positionedGroupNodes = groupNodes.map((grp, idx) => ({
      ...grp,
      position: {
        x: startX + idx * 380,
        y: Math.max(480, startY + maxLayerCount * rowHeight + 40),
      },
    }));

    const allLayouted = [...positionedFlowNodes, ...positionedStickyNotes, ...positionedGroupNodes];

    // Returns an object that has .nodes & .edges AND is also an iterable array
    const result = Object.assign([...allLayouted], {
      nodes: allLayouted,
      edges: edges,
    });

    return result;
  },

  async simulateTestNode(node, inputPayload = {}) {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const type = node.type || 'DEFAULT';
    const label = node.data?.label || 'Node';

    switch (type) {
      case 'AGENT':
      case 'AI_CHAT_MODEL':
        return {
          status: 'SUCCESS',
          nodeId: node.id,
          latencyMs: 540,
          tokens: 280,
          output: {
            text: `[Simulated Model Output from ${node.data?.config?.model || 'gpt-4o'}]\nSuccessfully analyzed input: "${JSON.stringify(inputPayload).slice(0, 100)}..."\nProduced structured resolution according to system instructions.`,
            confidence: 0.96,
          },
        };

      case 'FIRECRAWL_SEARCH':
        return {
          status: 'SUCCESS',
          nodeId: node.id,
          latencyMs: 980,
          output: {
            query: inputPayload.query || 'AI Agent workflows 2026',
            results: [
              { title: 'Modern Agentic Architecture Guide', url: 'https://docs.onetab.ai/agents', snippet: 'Visual node graph design and deterministic execution pipelines...' },
              { title: 'Firecrawl API Release Notes', url: 'https://firecrawl.dev/changelog', snippet: 'Fast parallel web crawling with automated LLM schema extraction.' },
            ],
          },
        };

      case 'KB_SEARCH':
        return {
          status: 'SUCCESS',
          nodeId: node.id,
          latencyMs: 320,
          output: {
            articles: [
              { id: 'art-101', title: 'Single Sign-On (SAML/Okta) Setup Manual', score: 0.94 },
              { id: 'art-102', title: 'Billing Refund Protocols & Authority Matrix', score: 0.88 },
            ],
            topScore: 0.94,
          },
        };

      case 'USER_APPROVAL':
        return {
          status: 'WAITING_APPROVAL',
          nodeId: node.id,
          latencyMs: 80,
          output: {
            approvalId: `appr-${Date.now().toString(36)}`,
            state: 'PAUSED',
            message: 'Execution paused. Waiting for supervisor approval in Approval Center.',
          },
        };

      case 'IF_ELSE':
        return {
          status: 'SUCCESS',
          nodeId: node.id,
          latencyMs: 15,
          output: {
            evaluatedCondition: true,
            selectedBranch: 'true',
          },
        };

      case 'APP_CONNECTOR_ACTION':
      case 'TEAMS_SEND_MESSAGE':
        return {
          status: 'SUCCESS',
          nodeId: node.id,
          latencyMs: 240,
          output: {
            connectorId: node.data?.config?.connectorId || 'microsoft-teams',
            connectionId: node.data?.config?.connectionId || 'conn-ms-teams-corp',
            actionId: node.data?.config?.actionId || 'send_channel_message',
            messageId: `msg-${Date.now().toString(36)}`,
            webUrl: 'https://teams.microsoft.com/l/message/19%3Ageneral%40thread.tacv2/168000000',
            teamId: node.data?.config?.teamId || 'team-eng-core',
            channelId: node.data?.config?.channelId || 'general',
            status: 'SENT',
          },
        };

      case 'TEAMS_CREATE_MEETING':
        return {
          status: 'SUCCESS',
          nodeId: node.id,
          latencyMs: 310,
          output: {
            meetingId: `mtg-${Date.now().toString(36)}`,
            subject: node.data?.config?.subject || 'AI Agent Consultation',
            joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/19%3Ameeting_consultation_test',
            status: 'SCHEDULED',
          },
        };

      default:
        return {
          status: 'SUCCESS',
          nodeId: node.id,
          latencyMs: 90,
          output: {
            message: `Node "${label}" executed successfully.`,
            receivedInput: inputPayload,
            timestamp: new Date().toISOString(),
          },
        };
    }
  },
};
