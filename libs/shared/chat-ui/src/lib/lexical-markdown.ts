import {
  CHECK_LIST,
  type ElementTransformer,
  TRANSFORMERS,
  type Transformer,
} from '@lexical/markdown';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';

/**
 * `---`, `***` or `___` on their own line become a divider.
 *
 * Lexical ships no rule transformer because the node lives in the React
 * package rather than in `@lexical/markdown`, so it has to be assembled here.
 */
const HORIZONTAL_RULE: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => ($isHorizontalRuleNode(node) ? '---' : null),
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _children, _match, isImport) => {
    const rule = $createHorizontalRuleNode();

    // At the end of the document the paragraph the user is typing in has to
    // survive, or the caret has nowhere to go after the divider appears.
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(rule);
    } else {
      parentNode.insertBefore(rule);
    }

    rule.selectNext();
  },
  type: 'element',
};

/**
 * Every markdown shortcut the composer understands.
 *
 * Order matters twice over: `CHECK_LIST` has to be tried before the bullet
 * list transformer that would otherwise claim `- [ ]`, and the horizontal rule
 * before the `ITALIC_UNDERSCORE`/`BOLD` rules that would otherwise pick apart
 * `___`. Lexical's own `TRANSFORMERS` is already internally ordered, so it
 * goes last as a block.
 *
 * The same list is used for typing (live shortcuts), for pasting markdown in,
 * and for serialising the message on send — which is what keeps what you typed
 * and what gets sent in agreement.
 */
export const CHAT_TRANSFORMERS: Transformer[] = [
  CHECK_LIST,
  HORIZONTAL_RULE,
  ...TRANSFORMERS,
];
