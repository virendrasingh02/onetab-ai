import { storage } from './storage.js';
import { INITIAL_APPROVALS } from './mockData.js';

const STORAGE_KEY = 'approvals_list';

function loadApprovals() {
  const cached = storage.get(STORAGE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  storage.set(STORAGE_KEY, INITIAL_APPROVALS);
  return INITIAL_APPROVALS;
}

export const approvalService = {
  async getApprovals(state = 'PENDING') {
    const list = loadApprovals();
    if (!state || state === 'ALL') return list;
    return list.filter((a) => a.status === state);
  },

  async decideApproval(approvalId, decision, comment = '', decidedBy = 'Alex Rivera (Supervisor)') {
    const list = loadApprovals();
    const item = list.find((a) => a.id === approvalId);
    if (!item) throw new Error('Approval request not found');

    item.status = decision; // 'APPROVED' | 'REJECTED'
    item.decidedAt = new Date().toISOString();
    item.decidedBy = decidedBy;
    item.decisionComment = comment;

    storage.set(STORAGE_KEY, list);
    return item;
  },

  async createApproval(data) {
    const list = loadApprovals();
    const newApproval = {
      id: `appr-${Date.now().toString(36)}`,
      executionId: data.executionId || 'exec-mock',
      agentId: data.agentId || 'agent-support-pro',
      agentName: data.agentName || 'AI Specialist',
      title: data.title || 'Action Sign-off Required',
      description: data.description || 'Workflow paused awaiting human verification.',
      category: data.category || 'GENERAL_REVIEW',
      status: 'PENDING',
      priority: data.priority || 'MEDIUM',
      requestedBy: data.requestedBy || 'Autonomous Workflow Node',
      assignedTo: data.assignedTo || 'Workspace Admins',
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      proposedPayload: data.proposedPayload || {},
    };
    list.unshift(newApproval);
    storage.set(STORAGE_KEY, list);
    return newApproval;
  },
};
