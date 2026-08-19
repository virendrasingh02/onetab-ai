import {
  $applyNodeReplacement,
  $getState,
  $setState,
  addClassNamesToElement,
  createState,
  type EditorConfig,
  type LexicalNode,
  TextNode,
} from 'lexical';

/**
 * The platform id behind a chip: the user id for `@someone`, the command name
 * for `/topic`.
 *
 * It rides along as node state rather than as a class field so that copy,
 * paste, undo and JSON serialisation carry it without any extra plumbing.
 */
const targetIdState = createState('targetId', {
  parse: (value: unknown) => (typeof value === 'string' ? value : ''),
});

/**
 * A `@someone` chip.
 *
 * Segmented mode is what makes it behave like one object: backspace removes
 * the whole mention rather than shaving a letter off the display name, and the
 * caret cannot land inside it. The node still extends TextNode, so the message
 * it serialises to is the plain `@name` the rest of the platform already
 * understands — nothing downstream has to learn a new wire format.
 */
export class MentionNode extends TextNode {
  override $config() {
    return this.config('mention', {
      extends: TextNode,
      stateConfigs: [{ stateConfig: targetIdState, flat: true }],
    });
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    addClassNamesToElement(element, config.theme.mention);
    element.setAttribute('data-mention-id', $getState(this, targetIdState));
    return element;
  }

  override isTextEntity(): true {
    return true;
  }

  override canInsertTextBefore(): boolean {
    return false;
  }

  override canInsertTextAfter(): boolean {
    return false;
  }
}

/** A `/command` chip, atomic for the same reasons as {@link MentionNode}. */
export class CommandNode extends TextNode {
  override $config() {
    return this.config('command', {
      extends: TextNode,
      stateConfigs: [{ stateConfig: targetIdState, flat: true }],
    });
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    addClassNamesToElement(element, config.theme.command);
    element.setAttribute('data-command', $getState(this, targetIdState));
    return element;
  }

  override isTextEntity(): true {
    return true;
  }

  override canInsertTextBefore(): boolean {
    return false;
  }

  override canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createMentionNode(
  displayName: string,
  targetId = '',
): MentionNode {
  const node = $applyNodeReplacement(new MentionNode(`@${displayName}`));
  node.setMode('segmented').toggleDirectionless();
  return $setState(node, targetIdState, targetId);
}

export function $createCommandNode(name: string): CommandNode {
  const withSlash = name.startsWith('/') ? name : `/${name}`;
  const node = $applyNodeReplacement(new CommandNode(withSlash));
  node.setMode('segmented').toggleDirectionless();
  return $setState(node, targetIdState, withSlash.slice(1));
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}

export function $isCommandNode(
  node: LexicalNode | null | undefined,
): node is CommandNode {
  return node instanceof CommandNode;
}

/** The user id a mention points at, or the command name behind a command chip. */
export function $getChipTarget(node: MentionNode | CommandNode): string {
  return $getState(node, targetIdState);
}
