import { describe, it, expect } from 'vitest';
import { createEditor } from 'lexical';
import {
  MentionNode,
  CommandNode,
  $createMentionNode,
  $createCommandNode,
  $getChipTarget,
  $getMentionKind,
  $isMentionNode,
  $isCommandNode,
} from './lexical-nodes.js';

describe('lexical-nodes', () => {
  const editor = createEditor({
    nodes: [MentionNode, CommandNode],
  });

  it('$createMentionNode defaults to kind "user" and stores targetId and mentionKind', () => {
    editor.update(() => {
      const node = $createMentionNode('Alice', 'user-123');
      expect($isMentionNode(node)).toBe(true);
      expect(node.getTextContent()).toBe('@Alice');
      expect($getChipTarget(node)).toBe('user-123');
      expect($getMentionKind(node)).toBe('user');
    });
  });

  it('$createMentionNode preserves explicit kind (agent, coworker, app, group)', () => {
    editor.update(() => {
      const agentNode = $createMentionNode('CodeAssistant', 'agent-1', 'agent');
      expect($getChipTarget(agentNode)).toBe('agent-1');
      expect($getMentionKind(agentNode)).toBe('agent');

      const coworkerNode = $createMentionNode('FinanceBot', 'cw-1', 'coworker');
      expect($getMentionKind(coworkerNode)).toBe('coworker');

      const appNode = $createMentionNode('GitHub', 'app-1', 'app');
      expect($getMentionKind(appNode)).toBe('app');

      const groupNode = $createMentionNode('channel', 'group-all', 'group');
      expect($getMentionKind(groupNode)).toBe('group');
    });
  });

  it('$createCommandNode preserves command name without affecting MentionNode', () => {
    editor.update(() => {
      const cmdNode = $createCommandNode('topic');
      expect($isCommandNode(cmdNode)).toBe(true);
      expect(cmdNode.getTextContent()).toBe('/topic');
      expect($getChipTarget(cmdNode)).toBe('topic');
    });
  });
});
