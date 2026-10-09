import type { Connection, Edge, Node } from '@xyflow/react';
import {
  getSlot,
  isValidSlotConnection,
  slotConnectionError,
} from './agent-slots.js';

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Checks whether adding an edge between source and target would introduce a cycle.
 * Traverses from `target` following outgoing edges to see if it reaches `source`.
 */
function wouldCreateCycle(sourceId: string, targetId: string, edges: Edge[]): boolean {
  const visited = new Set<string>();
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of edges) {
      if (edge.source === current) {
        // Skip slot attachments from cycle detection (they are subordinate components, not flow order)
        if (getSlot(edge.sourceHandle)) continue;
        queue.push(edge.target);
      }
    }
  }

  return false;
}

/**
 * Validates any connection attempted on the AI Agent Studio canvas.
 * Unifies agent slot rules, self-connection protection, duplicate prevention,
 * and cycle detection while allowing loops.
 */
export function validateWorkflowConnection(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): ConnectionValidationResult {
  const { source, target, sourceHandle, targetHandle } = connection;

  // 1. Must have valid source and target
  if (!source || !target) {
    return { valid: false, reason: 'Invalid connection endpoints' };
  }

  // 2. Self connection prevention
  if (source === target) {
    return { valid: false, reason: 'A step cannot connect directly to itself' };
  }

  // 3. Agent slot validation (if either end involves an agent slot)
  const isAgentSlotAttempt =
    (sourceHandle && Boolean(getSlot(sourceHandle))) ||
    (targetHandle && Boolean(getSlot(targetHandle)));

  if (isAgentSlotAttempt) {
    const slotError = slotConnectionError(connection, nodes, edges);
    if (slotError) {
      return { valid: false, reason: slotError };
    }
    const isSlotValid = isValidSlotConnection(connection, nodes, edges);
    if (!isSlotValid) {
      return { valid: false, reason: 'Incompatible component for this agent slot' };
    }
    return { valid: true };
  }

  // 4. Duplicate edge check
  const alreadyConnected = edges.some(
    (e) =>
      e.source === source &&
      e.target === target &&
      (e.sourceHandle ?? null) === (sourceHandle ?? null) &&
      (e.targetHandle ?? null) === (targetHandle ?? null),
  );
  if (alreadyConnected) {
    return { valid: false, reason: 'These steps are already connected at those handles' };
  }

  // 5. Node existence & type checks
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: 'Connecting nodes cannot be found' };
  }

  const sourceType = (sourceNode.type || '').toUpperCase();
  const targetType = (targetNode.type || '').toUpperCase();

  // Annotations, notes, and stages do not accept flow connections
  if (/NOTE|STICKY|ANNOTATION/.test(sourceType) || /NOTE|STICKY|ANNOTATION/.test(targetType)) {
    return { valid: false, reason: 'Sticky notes cannot be part of the execution flow' };
  }

  // End nodes cannot have outgoing flow connections
  if (/^END$|^OUTPUT$/.test(sourceType)) {
    return { valid: false, reason: 'End nodes cannot have outgoing connections' };
  }

  // Triggers cannot be downstream of other steps
  if (/^START$|^TRIGGER/.test(targetType)) {
    return { valid: false, reason: 'Triggers cannot receive inbound connections' };
  }

  // 6. Cycle prevention: allow loops on explicit loop nodes (LOOP, WHILE_LOOP, RETRY_NODE), but reject unintentional cycles
  const isLoopNode = /LOOP|WHILE|RETRY/.test(sourceType) || /LOOP|WHILE|RETRY/.test(targetType);
  if (!isLoopNode && wouldCreateCycle(source, target, edges)) {
    return {
      valid: false,
      reason: 'Creating a closed loop is not allowed here. Use a Loop or While node for repetition.',
    };
  }

  return { valid: true };
}

/**
 * Returns error string if connection is invalid, or null if valid.
 */
export function getWorkflowConnectionError(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): string | null {
  const result = validateWorkflowConnection(connection, nodes, edges);
  return result.valid ? null : result.reason || 'Invalid connection';
}
