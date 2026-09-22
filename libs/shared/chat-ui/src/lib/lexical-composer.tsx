import {
  $createCodeNode,
  $isCodeNode,
  CodeHighlightNode,
  CodeNode,
} from '@lexical/code';
import { HashtagNode } from '@lexical/hashtag';
import { $generateNodesFromDOM } from '@lexical/html';
import {
  $isLinkNode,
  AutoLinkNode,
  autoLinkEmailMatcher,
  autoLinkUrlMatcher,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '@lexical/link';
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HashtagPlugin } from '@lexical/react/LexicalHashtagPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  $createQuoteNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $nodesOfType,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  IS_APPLE,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import {
  AtSign,
  BarChart2,
  Blocks,
  Bot,
  Check,
  CheckSquare,
  Clock,
  Code,
  FileText,
  GitPullRequest,
  Hash,
  HelpCircle,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Megaphone,
  MessageSquare,
  Moon,
  Quote,
  Search,
  Settings,
  Slash,
  Smile,
  Sparkles,
  SquareCode,
  Strikethrough,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { cn } from '@org/utils';
import { Badge, UserAvatar } from '@org/ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { searchEmojiShortcodes, useEmojiShortcodeIndex } from '@org/ui';
import type { DetectedMention, MentionKind } from '@org/types';
import { CHAT_TRANSFORMERS } from './lexical-markdown.js';
import {
  $createCommandNode,
  $createMentionNode,
  $getChipTarget,
  $getMentionKind,
  CommandNode,
  MentionNode,
} from './lexical-nodes.js';
import type { SlashCommand } from './slash-commands.js';


/**
 * Classes the editor hangs on the DOM it renders.
 *
 * These deliberately mirror how a *sent* message is rendered, so the composer
 * is a preview of the message rather than a differently-styled text box.
 */
const EDITOR_THEME = {
  paragraph: 'mb-1 last:mb-0 leading-normal',
  text: {
    bold: 'font-bold text-foreground',
    italic: 'italic',
    strikethrough: 'line-through text-muted-foreground',
    underline: 'underline underline-offset-2',
    underlineStrikethrough: 'underline line-through underline-offset-2',
    highlight: 'rounded bg-warning/25 px-0.5 text-foreground',
    code: 'rounded bg-surface-inset px-1.5 py-0.5 font-mono text-xs text-info-text',
  },
  heading: {
    h1: 'mt-1 mb-1 text-lg font-bold leading-tight text-foreground',
    h2: 'mt-1 mb-1 text-base font-bold leading-tight text-foreground',
    h3: 'mt-1 mb-1 text-sm font-bold leading-tight text-foreground',
    h4: 'mt-1 mb-1 text-sm font-semibold text-foreground',
    h5: 'mt-1 mb-1 text-xs font-semibold text-foreground',
    h6: 'mt-1 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
  },
  list: {
    ul: 'list-disc pl-5 my-1 text-foreground',
    ol: 'list-decimal pl-5 my-1 text-foreground',
    listitem: 'my-0.5',
    listitemChecked:
      'relative my-0.5 list-none pl-6 line-through text-muted-foreground',
    listitemUnchecked: 'relative my-0.5 list-none pl-6',
    checklist: 'pl-2 my-1 list-none',
    nested: { listitem: 'list-none' },
  },
  quote:
    'border-l-4 border-primary pl-3 py-1 my-1 text-muted-foreground italic bg-surface-inset/50 rounded-r',
  code: 'block rounded-lg bg-surface-inset p-2.5 font-mono text-xs text-success-text border border-border my-1 whitespace-pre-wrap',
  hr: 'my-2 h-px border-0 bg-border',
  link: 'text-primary-text underline underline-offset-2 cursor-pointer',
  hashtag: 'rounded bg-info/15 px-1 font-semibold text-info-text',
  mention:
    'rounded border border-primary/40 bg-primary/20 px-1 font-semibold text-primary-text',
  command:
    'rounded border border-info/40 bg-info/15 px-1 font-semibold text-info-text',
};

/** Every node type the composer can hold. Anything missing here throws at runtime. */
const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  HashtagNode,
  HorizontalRuleNode,
  MentionNode,
  CommandNode,
];

const AUTO_LINK_MATCHERS = [autoLinkUrlMatcher, autoLinkEmailMatcher];

/**
 * Tag on `editor.update` calls the composer makes itself — restoring a draft,
 * clearing after send. `ChangeSignalsPlugin` uses it to tell "the app replaced
 * the contents" apart from "the user typed", so a draft restore doesn't fire
 * the typing indicator or schedule a redundant save.
 */
const SILENT_UPDATE_TAG = 'composer-silent';

/** Retract "typing" this long after the last edit. */
const TYPING_IDLE_MS = 4000;
/**
 * Re-assert "typing" at most this often while editing continues, so a long
 * uninterrupted burst keeps the remote indicator alive without pinging the
 * homeserver on every keystroke.
 */
const TYPING_REFRESH_MS = 3500;
/** Coalesce the markdown serialisation behind the draft this long. */
const DRAFT_DEBOUNCE_MS = 500;
/** Coalesce the live mention extraction this long. */
const MENTIONS_DEBOUNCE_MS = 300;


/** Someone (or something) a `@` mention can point at. */
export interface MentionCandidate {
  id: string;
  /** Display name, without the leading `@`. */
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  /** Group mentions (`@here`, `@channel`) are listed above people, AI agents and apps have distinct badges. */
  kind?: MentionKind;
  badge?: string;
  /**
   * The signed-in user. Tagged "you" in the menu and floated to the top of the
   * people list so mentioning yourself is a first-class option.
   */
  isSelf?: boolean;
}

export interface LexicalComposerInputProps {
  placeholder?: string;
  onSend: (text: string) => void | Promise<void>;
  /** When false, bare Enter inserts a newline and Ctrl/Cmd+Enter sends. Defaults to true. */
  enterToSend?: boolean;
  /**
   * Typing lifecycle for the remote "…is typing" indicator: `true` once when
   * the user starts, `false` after ~4s of no edits, on send, and on unmount —
   * not one call per keystroke.
   */
  onTyping?: (isTyping: boolean) => void;
  /**
   * The editor flipped between empty and non-empty. Cheap (a text-content
   * read, no markdown pass) — drive the Send button's enabled state off this.
   */
  onEmptyChange?: (isEmpty: boolean) => void;
  /**
   * Debounced serialised contents, for draft persistence. Fires ~0.5s after
   * typing settles rather than on every keystroke, and immediately once the
   * editor is emptied.
   */
  onDraftChange?: (markdown: string) => void;
  /**
   * Debounced list of mentions currently present in the editor document.
   */
  onMentionsChange?: (mentions: DetectedMention[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  initialMarkdown?: string;
  showToolbar?: boolean;
  /**
   * Staged images/files are waiting to go out with this message. Lets Enter
   * (and the imperative `send()`) fire with an empty body — the attachments
   * are the message — instead of the empty-body guard swallowing the keypress.
   */
  hasPendingAttachments?: boolean;
  /** Candidates for the in-editor `@` menu. With none, the menu stays closed. */
  members?: MentionCandidate[];
  /** Candidates for the in-editor `#` menu. With none, the menu stays closed. */
  channelMentions?: MentionCandidate[];
  /** Commands for the in-editor `/` menu, offered at the start of a message. */
  slashCommands?: SlashCommand[];
  onRegisterRef?: (ref: LexicalEditorRef) => void;
  /** Fired alongside the built-in menu, for hosts that render their own. */
  onMentionTrigger?: (query: string) => void;
  onMentionClose?: () => void;
  /** Extra controls appended to the toolbar's right-hand side. */
  toolbarSlot?: ReactNode;
}

/** Imperative handle the host composer drives the editor with. */
export interface LexicalEditorRef {
  insertText: (text: string) => void;
  insertMention: (candidate: MentionCandidate) => void;
  /** Replaces a half-typed `@query` with a finished mention chip. */
  replaceMentionQuery: (name: string, id?: string, kind?: MentionKind) => void;

  /** Replaces the whole document with the given markdown. */
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
  isEmpty: () => boolean;
  /** Sends the current content, exactly as pressing Enter would. */
  send: () => void;
  focus: () => void;
  clear: () => void;
}

/* -------------------------------------------------------------------------- */
/* Editor API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Enter-to-send plus the imperative handle, in one plugin.
 *
 * They share `send`, which is the point: the Send button and the Enter key
 * have to serialise the document the same way, and the serialisation — not the
 * plain text — is what the rest of the platform receives. `$convertToMarkdownString`
 * turns the rich document back into the markdown the message renderer reads,
 * so a bulleted list typed in the composer arrives as a bulleted list.
 */
function EditorApiPlugin({
  onSend,
  onTyping,
  onRegisterRef,
  hasPendingAttachments = false,
  enterToSend = true,
}: {
  onSend: (text: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onRegisterRef?: (ref: LexicalEditorRef) => void;
  hasPendingAttachments?: boolean;
  enterToSend?: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  const readMarkdown = useCallback(() => {
    let markdown = '';
    editor.getEditorState().read(() => {
      markdown = $convertToMarkdownString(CHAT_TRANSFORMERS, undefined, true);
    });
    return markdown;
  }, [editor]);

  const reset = useCallback(() => {
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      },
      { tag: SILENT_UPDATE_TAG },
    );
  }, [editor]);

  const send = useCallback(() => {
    const body = readMarkdown().trim();
    // A message with nothing but staged attachments is still a message —
    // only bail out when there's neither text nor anything else going out.
    if (!body && !hasPendingAttachments) return false;

    reset();
    onTyping?.(false);
    void onSend(body);
    return true;
  }, [readMarkdown, reset, onSend, onTyping, hasPendingAttachments]);

  const insertNodesAtCaret = useCallback(
    (build: () => ReturnType<typeof $createTextNode>[]) => {
      editor.update(() => {
        const nodes = build();
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $insertNodes(nodes);
          return;
        }

        // No caret — the user clicked a picker without focusing the editor
        // first. Append rather than dropping the insertion on the floor.
        const root = $getRoot();
        const last = root.getLastChild();
        const target = $isElementNode(last) ? last : $createParagraphNode();
        if (target !== last) root.append(target);
        for (const node of nodes) target.append(node);
        target.selectEnd();
      });
    },
    [editor],
  );

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (!event) return false;
        if (enterToSend === false) {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            return send();
          }
          return false;
        }
        // Shift+Enter is the line break. Everything else sends — the typeahead
        // menus claim Enter at CRITICAL priority while they are open, so this
        // only ever runs when no menu is showing.
        if (event.shiftKey) return false;
        event.preventDefault();
        return send();
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, send, enterToSend]);

  useEffect(() => {
    if (!onRegisterRef) return;

    onRegisterRef({
      insertText: (text) => insertNodesAtCaret(() => [$createTextNode(text)]),

      insertMention: (candidate) =>
        insertNodesAtCaret(() => [
          $createMentionNode(candidate.name, candidate.id, candidate.kind ?? 'user'),
          $createTextNode(' '),
        ]),

      replaceMentionQuery: (name, id, kind?: MentionKind) => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          // Walk back over the half-typed `@query` so the chip replaces it
          // instead of landing next to it.
          const anchor = selection.anchor;
          const node = anchor.getNode();
          if ($isTextNode(node)) {
            const typed = node.getTextContent().slice(0, anchor.offset);
            const at = typed.lastIndexOf('@');
            if (at !== -1) {
              selection.setTextNodeRange(node, at, node, anchor.offset);
            }
          }

          $insertNodes([
            $createMentionNode(name, id, kind ?? 'user'),
            $createTextNode(' '),
          ]);
        });
      },


      setMarkdown: (markdown) => {
        editor.update(
          () => {
            $convertFromMarkdownString(
              markdown,
              CHAT_TRANSFORMERS,
              undefined,
              true,
            );
            // Any programmatic content load — draft restore or an edit being
            // opened — should leave the caret ready to keep typing, not at
            // the top of the document.
            $getRoot().selectEnd();
          },
          { tag: SILENT_UPDATE_TAG },
        );
      },

      getMarkdown: readMarkdown,
      isEmpty: () => readMarkdown().trim().length === 0,
      send: () => void send(),
      focus: () => editor.focus(),
      clear: reset,
    });
  }, [editor, onRegisterRef, insertNodesAtCaret, readMarkdown, reset, send]);

  return null;
}

/** Mirrors the host's `disabled` flag into the editor's own editable state. */
function EditablePlugin({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  return null;
}

/**
 * The three signals the host needs out of a live editor, each on its own clock
 * so none of them rides the keystroke:
 *
 *  - `onEmptyChange` — fires only when the editor crosses the empty ⇄ non-empty
 *    line, from a `getTextContent()` read (no markdown pass). This is what the
 *    Send button should watch.
 *  - `onTyping` — `true` once when editing starts, `false` once it has been
 *    quiet for {@link TYPING_IDLE_MS}, so the remote indicator isn't spammed.
 *  - `onDraftChange` — the serialised document, debounced by
 *    {@link DRAFT_DEBOUNCE_MS}; the one expensive call, made at most a couple of
 *    times a second, and immediately when the box is cleared.
 *
 * A programmatic replace (draft restore, post-send reset — tagged
 * {@link SILENT_UPDATE_TAG}) refreshes the empty state but is not treated as the
 * user typing.
 */
function ChangeSignalsPlugin({
  onTyping,
  onEmptyChange,
  onDraftChange,
  onMentionsChange,
}: {
  onTyping?: (isTyping: boolean) => void;
  onEmptyChange?: (isEmpty: boolean) => void;
  onDraftChange?: (markdown: string) => void;
  onMentionsChange?: (mentions: DetectedMention[]) => void;
}) {
  const [editor] = useLexicalComposerContext();

  // Latest callbacks, without re-subscribing the update listener every render.
  const callbacks = useRef({
    onTyping,
    onEmptyChange,
    onDraftChange,
    onMentionsChange,
  });
  callbacks.current = {
    onTyping,
    onEmptyChange,
    onDraftChange,
    onMentionsChange,
  };

  useEffect(() => {
    let typing = false;
    let lastTypingPing = 0;
    let wasEmpty: boolean | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let draftTimer: ReturnType<typeof setTimeout> | null = null;
    let mentionsTimer: ReturnType<typeof setTimeout> | null = null;

    const readIsEmpty = () =>
      editor.getEditorState().read(() => {
        const root = $getRoot();
        return (
          root.getTextContent().trim().length === 0 &&
          root.getChildrenSize() <= 1
        );
      });

    const stopTyping = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (typing) {
        typing = false;
        lastTypingPing = 0;
        callbacks.current.onTyping?.(false);
      }
    };

    const pingTyping = () => {
      const now = Date.now();
      if (!typing || now - lastTypingPing > TYPING_REFRESH_MS) {
        typing = true;
        lastTypingPing = now;
        callbacks.current.onTyping?.(true);
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(stopTyping, TYPING_IDLE_MS);
    };

    const cancelDraft = () => {
      if (draftTimer) {
        clearTimeout(draftTimer);
        draftTimer = null;
      }
    };

    const flushDraft = () => {
      cancelDraft();
      const write = callbacks.current.onDraftChange;
      if (!write) return;
      let markdown = '';
      editor.getEditorState().read(() => {
        markdown = $convertToMarkdownString(CHAT_TRANSFORMERS, undefined, true);
      });
      write(markdown);
    };

    const cancelMentions = () => {
      if (mentionsTimer) {
        clearTimeout(mentionsTimer);
        mentionsTimer = null;
      }
    };

    const flushMentions = () => {
      cancelMentions();
      const write = callbacks.current.onMentionsChange;
      if (!write) return;
      editor.getEditorState().read(() => {
        const nodes = $nodesOfType(MentionNode);
        const mentions: DetectedMention[] = nodes.map((node) => ({
          id: $getChipTarget(node),
          kind: $getMentionKind(node),
          displayName: node.getTextContent().replace(/^@/, ''),
        }));
        write(mentions);
      });
    };

    // Seed the empty state so the Send button is right before the first edit
    // (e.g. a restored draft present at mount).
    wasEmpty = readIsEmpty();
    callbacks.current.onEmptyChange?.(wasEmpty);

    const unregister = editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves, tags }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

        const isEmpty = editorState.read(() => {
          const root = $getRoot();
          return (
            root.getTextContent().trim().length === 0 &&
            root.getChildrenSize() <= 1
          );
        });
        if (isEmpty !== wasEmpty) {
          wasEmpty = isEmpty;
          callbacks.current.onEmptyChange?.(isEmpty);
        }

        // The app swapped the contents, not the user.
        if (tags.has(SILENT_UPDATE_TAG) || tags.has('history-merge')) {
          stopTyping();
          cancelDraft();
          cancelMentions();
          return;
        }

        pingTyping();

        if (isEmpty) {
          flushDraft();
          cancelMentions();
          callbacks.current.onMentionsChange?.([]);
        } else {
          cancelDraft();
          draftTimer = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
          if (callbacks.current.onMentionsChange) {
            cancelMentions();
            mentionsTimer = setTimeout(flushMentions, MENTIONS_DEBOUNCE_MS);
          }
        }
      },
    );

    return () => {
      unregister();
      flushDraft();
      cancelMentions();
      stopTyping();
    };
  }, [editor]);

  return null;
}

/**
 * Formatting shortcuts, on the same keys Slack binds them to. They work
 * whether or not the formatting bar above is open — the bar is there for
 * discovery, not because it is what makes these active.
 *
 * List and quote shortcuts *set* the block rather than toggling it back to a
 * paragraph on a second press. The toolbar buttons do toggle, but that reads
 * `blockType` state private to `LexicalToolbar`; duplicating it here for a
 * keyboard shortcut wasn't worth it when Lexical's own list commands are
 * already idempotent on a block that's already that type.
 */
function FormattingShortcutsPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const hasModifier = IS_APPLE ? event.metaKey : event.ctrlKey;
        if (!hasModifier) return false;

        // `event.code` (the physical key) rather than `event.key` (the
        // character it produces): Shift+7 types '&' on a standard layout, not
        // '7', so matching the digit bindings below against `key` would never
        // fire. Letters happen to survive a Shift on `key` too (it's just the
        // upper-cased letter), but `code` is the one rule that's right for both.
        if (!event.shiftKey) {
          if (event.code === 'KeyB') {
            event.preventDefault();
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
            return true;
          }
          if (event.code === 'KeyI') {
            event.preventDefault();
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
            return true;
          }
          return false;
        }

        switch (event.code) {
          case 'KeyX':
            event.preventDefault();
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
            return true;
          case 'KeyC':
            event.preventDefault();
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
            return true;
          case 'Digit7':
            event.preventDefault();
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            return true;
          case 'Digit8':
            event.preventDefault();
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            return true;
          case 'Digit9':
            event.preventDefault();
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createQuoteNode());
              }
            });
            return true;
          default:
            return false;
        }
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
}

/* -------------------------------------------------------------------------- */
/* Paste normalization                                                        */
/* -------------------------------------------------------------------------- */

/** Tags the sanitizer keeps. Anything else is unwrapped — its text survives,
 *  the wrapper doesn't — which is what flattens layout `<div>`s, `<span>`s,
 *  `<font>` tags and table markup (`table/tr/td/…` aren't here) alike. */
const PASTE_ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
  'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'br',
]);

/** Never kept, never unwrapped — dropped along with their contents. */
const PASTE_DROPPED_TAGS = new Set([
  'script', 'style', 'meta', 'link', 'head', 'title',
  'iframe', 'object', 'embed', 'noscript', 'img', 'svg', 'video', 'audio',
]);

/** Only http(s)/mailto survive on a pasted `<a href>` — anything else
 *  (`javascript:`, `data:`, …) is a script-injection vector, not a link. */
function isSafePasteHref(href: string): boolean {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) return true; // relative URL
  return /^(https?|mailto):/i.test(href);
}

/**
 * Google Docs, Word and Notion encode bold/italic/underline/strikethrough as
 * inline `style` (`font-weight:700`, not `<b>`) rather than semantic tags —
 * so before attributes get stripped below, real emphasis is promoted into a
 * `<strong>/<em>/<u>/<s>` wrapper that survives. Everything else in `style`
 * (color, font-family, font-size, margins, line-height, background) is purely
 * decorative and is simply dropped with the rest of the attributes.
 */
function wrapPasteSemanticStyle(doc: Document, element: HTMLElement): void {
  const style = element.style;
  const weight = style.fontWeight;
  const isBold =
    weight === 'bold' ||
    weight === 'bolder' ||
    (/^\d+$/.test(weight) && Number(weight) >= 600);
  const isItalic = style.fontStyle === 'italic';
  const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`;
  const isUnderline = decoration.includes('underline');
  const isStrike = decoration.includes('line-through');

  const tag = element.tagName.toLowerCase();
  let target = element;
  const wrap = (wrapperTag: string) => {
    const wrapper = doc.createElement(wrapperTag);
    while (target.firstChild) wrapper.appendChild(target.firstChild);
    target.appendChild(wrapper);
    target = wrapper;
  };

  if (isBold && tag !== 'strong' && tag !== 'b') wrap('strong');
  if (isItalic && tag !== 'em' && tag !== 'i') wrap('em');
  if (isUnderline && tag !== 'u') wrap('u');
  if (isStrike && tag !== 's' && tag !== 'strike' && tag !== 'del') wrap('s');
}

/**
 * Recursively strips pasted HTML down to what the composer actually
 * understands: promotes real inline-style emphasis into semantic tags (see
 * above), strips every attribute except `href` on links (and only a safe
 * one), and unwraps — keeping the text, dropping the wrapper — anything
 * outside {@link PASTE_ALLOWED_TAGS}. What's left maps directly onto nodes
 * already registered in {@link EDITOR_NODES}; nothing new to register.
 */
function sanitizePasteDom(doc: Document, node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      node.removeChild(child);
      continue;
    }
    if (!(child instanceof HTMLElement)) continue;

    const tag = child.tagName.toLowerCase();
    if (PASTE_DROPPED_TAGS.has(tag)) {
      node.removeChild(child);
      continue;
    }

    wrapPasteSemanticStyle(doc, child);
    // Recurse first so nested disallowed content is already cleaned up
    // whether this element ends up kept or unwrapped.
    sanitizePasteDom(doc, child);

    if (!PASTE_ALLOWED_TAGS.has(tag)) {
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      node.removeChild(child);
      continue;
    }

    const href = tag === 'a' ? child.getAttribute('href') : null;
    for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
    if (href && isSafePasteHref(href)) child.setAttribute('href', href);
  }
}

/**
 * Rich HTML paste from a website, Google Docs, Word or Notion must not carry
 * that source's typography into the message — but plain-looking formatting
 * (bold, lists, links, headings) should survive. Plain-text paste and our own
 * composer-to-composer copy/paste (`application/x-lexical-editor`, which
 * Lexical's own default handler already reconstructs with full node fidelity,
 * chips included) are left alone entirely — this only intercepts genuine
 * external `text/html`.
 */
function HtmlPastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent) || !event.clipboardData) {
          return false;
        }
        const clipboardData = event.clipboardData;
        if (clipboardData.getData('application/x-lexical-editor')) return false;

        const html = clipboardData.getData('text/html');
        if (!html || !html.trim()) return false;

        const dom = new DOMParser().parseFromString(html, 'text/html');
        sanitizePasteDom(dom, dom.body);
        if (dom.body.childNodes.length === 0) return false;

        event.preventDefault();
        editor.update(() => {
          const nodes = $generateNodesFromDOM(editor, dom);
          if (nodes.length === 0) return;

          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes(nodes);
          } else {
            $insertNodes(nodes);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}

/* -------------------------------------------------------------------------- */
/* Typeahead menus                                                             */
/* -------------------------------------------------------------------------- */

const MENU_CLASS =
  'w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl';

/**
 * Shell every typeahead menu renders into.
 *
 * It anchors *upwards*: the composer sits at the bottom of the viewport, where
 * Lexical's own downward placement would push the list off-screen.
 */
function renderCommandIcon(iconName?: string) {
  const className = 'size-3.5 shrink-0';
  switch (iconName) {
    case 'help':
      return <HelpCircle className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'megaphone':
      return <Megaphone className={className} />;
    case 'video':
      return <Video className={className} />;
    case 'clock':
      return <Clock className={className} />;
    case 'hash':
      return <Hash className={className} />;
    case 'user-plus':
      return <UserPlus className={className} />;
    case 'message-square':
      return <MessageSquare className={className} />;
    case 'bar-chart':
      return <BarChart2 className={className} />;
    case 'moon':
      return <Moon className={className} />;
    case 'smile':
      return <Smile className={className} />;
    case 'search':
      return <Search className={className} />;
    case 'settings':
      return <Settings className={className} />;
    case 'check-square':
      return <CheckSquare className={className} />;
    case 'user-check':
      return <UserCheck className={className} />;
    case 'git-pull-request':
      return <GitPullRequest className={className} />;
    case 'file-text':
      return <FileText className={className} />;
    case 'bot':
      return <Bot className={className} />;
    default:
      return <Slash className={className} />;
  }
}

/**
 * Shell every typeahead menu renders into.
 *
 * It anchors *upwards*: the composer sits at the bottom of the viewport, where
 * Lexical's own downward placement would push the list off-screen.
 */
function MenuShell({
  label,
  icon,
  hint,
  id,
  children,
}: {
  label: string;
  icon: ReactNode;
  hint?: string;
  id?: string;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = menuRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      const shift = rect.right - (window.innerWidth - 8);
      el.style.left = `-${shift}px`;
    } else if (rect.left < 8) {
      el.style.left = `${8 - rect.left}px`;
    }
  }, []);

  return (
    <div
      ref={menuRef}
      role="region"
      aria-label={`${label} suggestions`}
      className={`left-0 mb-2 absolute bottom-full z-120 ${MENU_CLASS}`}
    >
      <div className="px-3 py-1.5 font-bold tracking-wider flex items-center justify-between border-b border-border text-[10px] uppercase">
        <span className="gap-1.5 flex items-center text-primary-text">
          {icon}
          <span>{label}</span>
        </span>
        {hint ? <span className="text-subtle">{hint}</span> : null}
      </div>
      <ul
        id={id}
        role="listbox"
        aria-label={label}
        className="max-h-64 p-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </ul>
    </div>
  );
}

function MenuItem({
  id,
  option,
  isSelected,
  onSelect,
  onHighlight,
  children,
}: {
  id?: string;
  option: MenuOption;
  isSelected: boolean;
  onSelect: () => void;
  onHighlight: () => void;
  children: ReactNode;
}) {
  const itemRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      ref={(el) => {
        itemRef.current = el;
        option.setRefElement(el);
      }}
    >
      <button
        type="button"
        tabIndex={-1}
        onMouseEnter={onHighlight}
        onMouseDown={(event) => {
          // Keep the editor's selection alive: losing it would strand the
          // query text the option is supposed to replace.
          event.preventDefault();
        }}
        onClick={onSelect}
        className={`gap-2.5 px-2.5 py-1.5 text-xs flex w-full items-center rounded-lg text-left transition-colors ${
          isSelected ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
        }`}
      >
        {children}
      </button>
    </li>
  );
}

class MentionMenuOption extends MenuOption {
  constructor(readonly candidate: MentionCandidate) {
    super(`mention-${candidate.id}`);
  }
}

function MentionsPlugin({
  candidates,
  onOpenChange,
  onQuery,
}: {
  candidates: MentionCandidate[];
  onOpenChange: (open: boolean) => void;
  onQuery?: (query: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  // Names contain spaces, so the trigger has to keep matching past one.
  const triggerFn = useBasicTypeaheadTriggerMatch('@', {
    minLength: 0,
    maxLength: 32,
    allowWhitespace: true,
  });

  const options = useMemo(() => {
    const needle = (query ?? '').toLowerCase().trim();
    const matches = (candidate: MentionCandidate) =>
      !needle ||
      candidate.name.toLowerCase().includes(needle) ||
      candidate.subtitle?.toLowerCase().includes(needle);

    const inKind = (kind: MentionKind) =>
      candidates.filter((candidate) =>
        kind === 'user'
          ? !candidate.kind || candidate.kind === 'user'
          : candidate.kind === kind,
      );

    const groups = inKind('group').filter(matches);
    const people = inKind('user').filter(matches);
    const agents = inKind('agent').filter(matches);
    const coworkers = inKind('coworker').filter(matches);
    const apps = inKind('app').filter(matches);

    /*
     * People are what most `@`s reach for, so they sit right below the group
     * mentions and are never pushed out of view by a long agent/app roster — a
     * flat "first 12 of everything" slice used to drop every channel member
     * when the built-in agents and apps alone filled the list. Without a query
     * each kind still shows a representative slice; with one, people get the
     * widest berth and the bots stay a short list.
     */
    const [peopleCap, botCap] = needle ? [20, 8] : [8, 4];
    return [
      ...groups,
      ...people.slice(0, peopleCap),
      ...agents.slice(0, botCap),
      ...coworkers.slice(0, botCap),
      ...apps.slice(0, botCap),
    ].map((candidate) => new MentionMenuOption(candidate));
  }, [candidates, query]);

  const onSelectOption = useCallback(
    (
      option: MentionMenuOption,
      nodeToReplace: ReturnType<typeof $createTextNode> | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const mention = $createMentionNode(
          option.candidate.name,
          option.candidate.id,
          option.candidate.kind ?? 'user',
        );
        if (nodeToReplace) {
          nodeToReplace.replace(mention);
        } else {
          $insertNodes([mention]);
        }
        const spacer = $createTextNode(' ');
        mention.insertAfter(spacer);
        spacer.select();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<MentionMenuOption>
      options={options}
      triggerFn={triggerFn}
      commandPriority={COMMAND_PRIORITY_CRITICAL}
      onQueryChange={(matching) => {
        setQuery(matching);
        if (matching !== null) onQuery?.(matching);
      }}
      onOpen={() => onOpenChange(true)}
      onClose={() => onOpenChange(false)}
      onSelectOption={onSelectOption}
      menuRenderFn={(
        anchorRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (!anchorRef.current) return null;

        const groups = options.filter((o) => o.candidate.kind === 'group');
        const agents = options.filter((o) => o.candidate.kind === 'agent');
        const coworkers = options.filter((o) => o.candidate.kind === 'coworker');
        const apps = options.filter((o) => o.candidate.kind === 'app');
        const people = options.filter(
          (o) => !o.candidate.kind || o.candidate.kind === 'user',
        );

        const renderOption = (option: MentionMenuOption) => {
          const index = options.indexOf(option);
          const isAgent = option.candidate.kind === 'agent';
          const isCoworker = option.candidate.kind === 'coworker';
          const isApp = option.candidate.kind === 'app';
          const isGroup = option.candidate.kind === 'group';

          return (
            <MenuItem
              key={option.key}
              id={`mention-option-${index}`}
              option={option}
              isSelected={selectedIndex === index}
              onHighlight={() => setHighlightedIndex(index)}
              onSelect={() => selectOptionAndCleanUp(option)}
            >
              {isGroup ? (
                <span className="size-6 font-bold flex shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-text">
                  @
                </span>
              ) : isAgent ? (
                <span className="size-6 flex shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="size-3.5" />
                </span>
              ) : isCoworker ? (
                <span className="size-6 flex shrink-0 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="size-3.5" />
                </span>
              ) : isApp ? (
                <span className="size-6 flex shrink-0 items-center justify-center rounded-full border border-accent-violet/20 bg-accent-violet-soft text-accent-violet">
                  <Blocks className="size-3.5" />
                </span>
              ) : (
                <UserAvatar
                  name={option.candidate.name}
                  seed={option.candidate.id}
                  src={option.candidate.avatarUrl}
                  size="xs"
                  indicator={false}
                  className="size-6 font-bold shrink-0"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="gap-1.5 font-semibold flex items-center text-foreground">
                  <span className="truncate">@{option.candidate.name}</span>
                  {option.candidate.isSelf ? (
                    <span className="px-1 py-0 font-bold tracking-wider text-[9px] shrink-0 rounded bg-muted text-muted-foreground uppercase">
                      You
                    </span>
                  ) : null}
                  {isAgent ? (
                    <Badge
                      variant="primary"
                      className="py-0 h-3.5 font-bold tracking-wider text-[9px] uppercase"
                    >
                      AI AGENT
                    </Badge>
                  ) : isCoworker ? (
                    <Badge
                      variant="neutral"
                      className="py-0 h-3.5 font-bold tracking-wider border-purple-500/20 bg-purple-500/10 text-[9px] text-purple-600 dark:text-purple-400 uppercase"
                    >
                      COWORKER
                    </Badge>
                  ) : isApp ? (
                    <Badge
                      variant="neutral"
                      className="py-0 h-3.5 font-bold tracking-wider border-accent-violet/20 bg-accent-violet-soft text-[9px] text-accent-violet uppercase"
                    >
                      APP
                    </Badge>
                  ) : null}
                </span>
                {option.candidate.subtitle ? (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {option.candidate.subtitle}
                  </span>
                ) : null}
              </span>
            </MenuItem>
          );
        };

        return createPortal(
          <MenuShell
            label="Mention"
            hint="↑↓ to browse · ↵ or Tab to insert"
            icon={<AtSign className="size-3.5" />}
          >
            {options.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matching members found
              </li>
            ) : (
              <>
                {groups.length > 0 ? (
                  <li className="px-2 py-1 font-bold text-[10px] text-subtle uppercase">
                    Group mentions
                  </li>
                ) : null}
                {groups.map(renderOption)}

                {people.length > 0 ? (
                  <li className="mt-1 px-2 py-1 font-bold text-[10px] text-subtle uppercase">
                    People — {people.length}
                  </li>
                ) : null}
                {people.map(renderOption)}

                {agents.length > 0 ? (
                  <li className="mt-1 px-2 py-1 font-bold text-[10px] text-primary uppercase">
                    AI Agents — {agents.length}
                  </li>
                ) : null}
                {agents.map(renderOption)}

                {coworkers.length > 0 ? (
                  <li className="mt-1 px-2 py-1 font-bold text-[10px] text-purple-600 dark:text-purple-400 uppercase">
                    AI Coworkers — {coworkers.length}
                  </li>
                ) : null}
                {coworkers.map(renderOption)}

                {apps.length > 0 ? (
                  <li className="mt-1 px-2 py-1 font-bold text-[10px] text-accent-violet uppercase">
                    Connected Apps — {apps.length}
                  </li>
                ) : null}
                {apps.map(renderOption)}
              </>
            )}
          </MenuShell>,
          anchorRef.current,
        );
      }}
    />
  );
}

class ChannelMenuOption extends MenuOption {
  constructor(readonly candidate: MentionCandidate) {
    super(`channel-${candidate.id}`);
  }
}

/**
 * `#channel` search-and-insert. Deliberately not a `MentionNode`: it inserts
 * plain `#slug` text, which the already-mounted `<HashtagPlugin />` picks up
 * and styles on its own — exactly as if the user had typed it by hand. That
 * keeps channel references on the same wire format (and read-side rendering)
 * hand-typed hashtags already have, with search replacing guesswork.
 */
function ChannelMentionsPlugin({
  candidates,
  onOpenChange,
}: {
  candidates: MentionCandidate[];
  onOpenChange: (open: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch('#', {
    minLength: 0,
    maxLength: 32,
  });

  const options = useMemo(() => {
    const needle = (query ?? '').toLowerCase().trim();
    return candidates
      .filter(
        (candidate) =>
          !needle ||
          candidate.name.toLowerCase().includes(needle) ||
          candidate.subtitle?.toLowerCase().includes(needle),
      )
      .slice(0, 12)
      .map((candidate) => new ChannelMenuOption(candidate));
  }, [candidates, query]);

  const onSelectOption = useCallback(
    (
      option: ChannelMenuOption,
      nodeToReplace: ReturnType<typeof $createTextNode> | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const chip = $createTextNode(`#${option.candidate.name}`);
        if (nodeToReplace) {
          nodeToReplace.replace(chip);
        } else {
          $insertNodes([chip]);
        }
        const spacer = $createTextNode(' ');
        chip.insertAfter(spacer);
        spacer.select();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<ChannelMenuOption>
      options={options}
      triggerFn={triggerFn}
      commandPriority={COMMAND_PRIORITY_CRITICAL}
      onQueryChange={setQuery}
      onOpen={() => onOpenChange(true)}
      onClose={() => onOpenChange(false)}
      onSelectOption={onSelectOption}
      menuRenderFn={(
        anchorRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (!anchorRef.current) return null;

        return createPortal(
          <MenuShell
            label="Channel"
            hint="↑↓ to browse · ↵ or Tab to insert"
            icon={<Hash className="size-3.5" />}
          >
            {options.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matching channels found
              </li>
            ) : (
              options.map((option, index) => (
                <MenuItem
                  key={option.key}
                  id={`channel-option-${index}`}
                  option={option}
                  isSelected={selectedIndex === index}
                  onHighlight={() => setHighlightedIndex(index)}
                  onSelect={() => selectOptionAndCleanUp(option)}
                >
                  <span className="size-6 flex shrink-0 items-center justify-center rounded-full bg-info/15 text-info-text">
                    <Hash className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold block truncate text-foreground">
                      #{option.candidate.name}
                    </span>
                    {option.candidate.subtitle ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {option.candidate.subtitle}
                      </span>
                    ) : null}
                  </span>
                </MenuItem>
              ))
            )}
          </MenuShell>,
          anchorRef.current,
        );
      }}
    />
  );
}

class CommandMenuOption extends MenuOption {
  constructor(readonly command: SlashCommand) {
    super(`command-${command.name}`);
  }
}

function SlashCommandsPlugin({
  commands,
  onOpenChange,
}: {
  commands: SlashCommand[];
  onOpenChange: (open: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const basicTrigger = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
    maxLength: 24,
  });

  // A command is only a command at the start of the message; anywhere else a
  // slash is just a slash (dates, paths, and/or).
  const triggerFn = useCallback(
    (text: string, editorInstance: Parameters<typeof basicTrigger>[1]) => {
      const match = basicTrigger(text, editorInstance);
      return match && match.leadOffset === 0 ? match : null;
    },
    [basicTrigger],
  );

  const options = useMemo(() => {
    const needle = (query ?? '').toLowerCase().trim();
    return commands
      .filter(
        (command) =>
          !needle ||
          command.name.slice(1).toLowerCase().startsWith(needle) ||
          command.description.toLowerCase().includes(needle),
      )
      .slice(0, 12)
      .map((command) => new CommandMenuOption(command));
  }, [commands, query]);

  const onSelectOption = useCallback(
    (
      option: CommandMenuOption,
      nodeToReplace: ReturnType<typeof $createTextNode> | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        // A prompt-scaffold command (AI Studio's `/summarize`, …) drops its
        // text at the caret for the user to keep typing from — it's a
        // starting point, not a tagged action, so it isn't a chip.
        if (option.command.expandsTo) {
          const text = $createTextNode(option.command.expandsTo);
          if (nodeToReplace) {
            nodeToReplace.replace(text);
          } else {
            $insertNodes([text]);
          }
          text.selectEnd();
          closeMenu();
          return;
        }

        const chip = $createCommandNode(option.command.name);
        if (nodeToReplace) {
          nodeToReplace.replace(chip);
        } else {
          $insertNodes([chip]);
        }
        const spacer = $createTextNode(' ');
        chip.insertAfter(spacer);
        spacer.select();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<CommandMenuOption>
      options={options}
      triggerFn={triggerFn}
      commandPriority={COMMAND_PRIORITY_CRITICAL}
      onQueryChange={setQuery}
      onOpen={() => onOpenChange(true)}
      onClose={() => onOpenChange(false)}
      onSelectOption={onSelectOption}
      menuRenderFn={(
        anchorRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (!anchorRef.current) return null;

        return createPortal(
          <MenuShell
            label="Commands"
            hint="↑↓ to browse · ↵ or Tab to pick"
            icon={<Slash className="size-3.5" />}
          >
            {options.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matching commands found
              </li>
            ) : (
              options.map((option, index) => (
                <MenuItem
                  key={option.key}
                  id={`command-option-${index}`}
                  option={option}
                  isSelected={selectedIndex === index}
                  onHighlight={() => setHighlightedIndex(index)}
                  onSelect={() => selectOptionAndCleanUp(option)}
                >
                  <span className="size-6 flex shrink-0 items-center justify-center rounded-md border border-info/20 bg-info/10 text-info-text">
                    {renderCommandIcon(option.command.icon)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold block truncate text-info-text">
                      {option.command.name}
                      {option.command.args ? (
                        <span className="ml-1 font-normal text-muted-foreground">
                          {option.command.args}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {option.command.description}
                    </span>
                  </span>
                </MenuItem>
              ))
            )}
          </MenuShell>,
          anchorRef.current,
        );
      }}
    />
  );
}

class EmojiMenuOption extends MenuOption {
  constructor(
    readonly char: string,
    readonly name: string,
  ) {
    super(`emoji-${name}`);
  }
}

function EmojiPickerPlugin({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  // Same Emojibase dataset the visual `<EmojiPicker>` renders, so a `:shortcode`
  // and the picker never disagree. Loads lazily on first use.
  const emojiIndex = useEmojiShortcodeIndex();

  // Two characters before suggesting: `:)` and clock times should not open a
  // menu on every keystroke.
  const triggerFn = useBasicTypeaheadTriggerMatch(':', {
    minLength: 2,
    maxLength: 24,
  });

  const options = useMemo(() => {
    const needle = (query ?? '').trim();
    if (!needle) return [];
    return searchEmojiShortcodes(emojiIndex, needle, 10).map(
      (emoji) =>
        new EmojiMenuOption(emoji.char, emoji.shortcodes[0] ?? emoji.label),
    );
  }, [query, emojiIndex]);

  const onSelectOption = useCallback(
    (
      option: EmojiMenuOption,
      nodeToReplace: ReturnType<typeof $createTextNode> | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const emoji = $createTextNode(option.char);
        if (nodeToReplace) {
          nodeToReplace.replace(emoji);
        } else {
          $insertNodes([emoji]);
        }
        emoji.selectEnd();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<EmojiMenuOption>
      options={options}
      triggerFn={triggerFn}
      commandPriority={COMMAND_PRIORITY_CRITICAL}
      onQueryChange={setQuery}
      onOpen={() => onOpenChange(true)}
      onClose={() => onOpenChange(false)}
      onSelectOption={onSelectOption}
      menuRenderFn={(
        anchorRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (!anchorRef.current || options.length === 0) return null;

        return createPortal(
          <MenuShell label="Emoji" icon={<Smile className="size-3.5" />}>
            {options.map((option, index) => (
              <MenuItem
                key={option.key}
                option={option}
                isSelected={selectedIndex === index}
                onHighlight={() => setHighlightedIndex(index)}
                onSelect={() => selectOptionAndCleanUp(option)}
              >
                <span className="text-base leading-none" aria-hidden>
                  {option.char}
                </span>
                <span className="truncate text-muted-foreground">
                  :{option.name}:
                </span>
              </MenuItem>
            ))}
          </MenuShell>,
          anchorRef.current,
        );
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                     */
/* -------------------------------------------------------------------------- */

type BlockType =
  'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'code' | 'ul' | 'ol' | 'check';


/**
 * The formatting bar.
 *
 * Every control reflects the caret: the bold button is lit inside bold text,
 * the list button inside a list. That feedback is what makes the markdown
 * shortcuts discoverable — type `- ` and watch the bullet button light up.
 *
 * Underline is deliberately absent. The composer serialises to markdown, which
 * has no underline, so offering it would quietly drop the formatting on send.
 */
export function ToolbarContent({
  toolbarSlot,
  onInteractionChange,
}: {
  toolbarSlot?: ReactNode;
  onInteractionChange?: (interacting: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [formats, setFormats] = useState({
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    highlight: false,
  });
  const [blockType, setBlockType] = useState<BlockType>('paragraph');
  const [isLink, setIsLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onInteractionChange?.(linkDraft !== null);
  }, [linkDraft, onInteractionChange]);

  const syncToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setFormats((prev) => {
      const next = {
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        strikethrough: selection.hasFormat('strikethrough'),
        code: selection.hasFormat('code'),
        highlight: selection.hasFormat('highlight'),
      };
      return prev.bold === next.bold &&
        prev.italic === next.italic &&
        prev.strikethrough === next.strikethrough &&
        prev.code === next.code &&
        prev.highlight === next.highlight
        ? prev
        : next;
    });

    const anchorNode = selection.anchor.getNode();
    const parent = anchorNode.getParent();
    setIsLink($isLinkNode(parent) || $isLinkNode(anchorNode));

    const element = anchorNode.getTopLevelElement() ?? anchorNode;
    if ($isListNode(element)) {
      const listType = element.getListType();
      setBlockType(
        listType === 'number' ? 'ol' : listType === 'check' ? 'check' : 'ul',
      );
    } else if ($isQuoteNode(element)) {
      setBlockType('quote');
    } else if ($isCodeNode(element)) {
      setBlockType('code');
    } else {
      setBlockType('paragraph');
    }
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(syncToolbar);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          syncToolbar();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [editor, syncToolbar]);

  useEffect(() => {
    if (linkDraft !== null) linkInputRef.current?.focus();
  }, [linkDraft]);

  useEffect(() => {
    if (linkDraft === null) return;

    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node;
      if (
        linkDraft !== null &&
        linkContainerRef.current &&
        !linkContainerRef.current.contains(target)
      ) {
        setLinkDraft(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (linkDraft !== null) {
          setLinkDraft(null);
          editor.focus();
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [linkDraft, editor]);

  const setBlock = useCallback(
    (next: BlockType) => {
      const target = next === blockType ? 'paragraph' : next;

      if (target === 'ul' || target === 'ol' || target === 'check') {
        editor.dispatchCommand(
          target === 'ul'
            ? INSERT_UNORDERED_LIST_COMMAND
            : target === 'ol'
              ? INSERT_ORDERED_LIST_COMMAND
              : INSERT_CHECK_LIST_COMMAND,
          undefined,
        );
        return;
      }

      if (blockType === 'ul' || blockType === 'ol' || blockType === 'check') {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        if (target === 'paragraph') return;
      }

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        $setBlocksType(selection, () =>
          target === 'quote'
            ? $createQuoteNode()
            : target === 'code'
              ? $createCodeNode()
              : $createParagraphNode(),
        );
      });
    },
    [editor, blockType],
  );

  const applyLink = useCallback(() => {
    const url = (linkDraft ?? '').trim();
    editor.dispatchCommand(
      TOGGLE_LINK_COMMAND,
      url ? (/^[a-z][\w+.-]*:/i.test(url) ? url : `https://${url}`) : null,
    );
    setLinkDraft(null);
    editor.focus();
  }, [editor, linkDraft]);

  return (
    <div
      role="toolbar"
      aria-label="Formatting tools"
      className="inline-flex items-center gap-0.5 rounded-2xl bg-[#2a2a2c] text-neutral-200 p-1 shadow-xl shadow-black/30 border border-white/10 select-none whitespace-nowrap"
    >
      {/* Link Button & Popover */}
      <div ref={linkContainerRef} className="relative">
        <button
          type="button"
          title={isLink ? 'Remove link' : 'Add link'}
          aria-label={isLink ? 'Remove link' : 'Add link'}
          aria-pressed={isLink}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (isLink) {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
              return;
            }
            setLinkDraft((current) => (current === null ? '' : null));
          }}
          className={cn(
            'size-7 flex items-center justify-center rounded-xl transition-colors',
            isLink || linkDraft !== null
              ? 'bg-white/20 text-white'
              : 'text-neutral-300 hover:bg-white/10 hover:text-white',
          )}
        >
          {isLink ? (
            <Link2Off className="size-4" />
          ) : (
            <Link2 className="size-4" />
          )}
        </button>

        {linkDraft !== null ? (
          <div className="left-0 mt-1.5 absolute top-full z-50 flex items-center gap-1.5 rounded-xl bg-[#242426] p-1.5 shadow-2xl border border-white/10">
            <Link2 className="size-3.5 shrink-0 text-neutral-400 ml-1" />
            <input
              ref={linkInputRef}
              type="url"
              aria-label="Link URL"
              placeholder="Paste or type URL…"
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setLinkDraft(null);
                  editor.focus();
                }
              }}
              className="w-48 text-xs bg-neutral-800/90 text-white placeholder:text-neutral-500 rounded-lg px-2.5 py-1 outline-none border border-neutral-700/60 focus:border-primary transition-colors"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyLink}
              className="size-6 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label="Apply link"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setLinkDraft(null);
                editor.focus();
              }}
              className="size-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cancel link"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Bold Button */}
      <button
        type="button"
        title="Bold (Ctrl+B)"
        aria-label="Bold"
        aria-pressed={formats.bold}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          formats.bold
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <span className="font-bold text-sm leading-none">B</span>
      </button>

      {/* Italic Button */}
      <button
        type="button"
        title="Italic (Ctrl+I)"
        aria-label="Italic"
        aria-pressed={formats.italic}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          formats.italic
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <span className="font-serif italic font-semibold text-sm leading-none">I</span>
      </button>

      {/* Strikethrough Button */}
      <button
        type="button"
        title="Strikethrough (Ctrl+Shift+X)"
        aria-label="Strikethrough"
        aria-pressed={formats.strikethrough}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
        }
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          formats.strikethrough
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <Strikethrough className="size-3.5" />
      </button>

      {/* Inline Code Button */}
      <button
        type="button"
        title="Inline code (Ctrl+Shift+C)"
        aria-label="Inline code"
        aria-pressed={formats.code}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          formats.code
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <Code className="size-3.5" />
      </button>

      <span className="mx-0.5 h-3.5 w-px bg-white/10 shrink-0" />

      {/* Bulleted List Button */}
      <button
        type="button"
        title="Bulleted list (Ctrl+Shift+8)"
        aria-label="Bulleted list"
        aria-pressed={blockType === 'ul'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setBlock('ul')}
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          blockType === 'ul'
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <List className="size-3.5" />
      </button>

      {/* Numbered List Button */}
      <button
        type="button"
        title="Numbered list (Ctrl+Shift+7)"
        aria-label="Numbered list"
        aria-pressed={blockType === 'ol'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setBlock('ol')}
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          blockType === 'ol'
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <ListOrdered className="size-3.5" />
      </button>

      <span className="mx-0.5 h-3.5 w-px bg-white/10 shrink-0" />

      {/* Quote Button */}
      <button
        type="button"
        title="Quote (Ctrl+Shift+9)"
        aria-label="Quote"
        aria-pressed={blockType === 'quote'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setBlock('quote')}
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          blockType === 'quote'
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <Quote className="size-3.5" />
      </button>

      {/* Code Block Button */}
      <button
        type="button"
        title="Code block (```)"
        aria-label="Code block"
        aria-pressed={blockType === 'code'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setBlock('code')}
        className={cn(
          'size-7 flex items-center justify-center rounded-xl transition-colors',
          blockType === 'code'
            ? 'bg-white/20 text-white'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <SquareCode className="size-3.5" />
      </button>

      {toolbarSlot ? (
        <>
          <span className="mx-0.5 h-3.5 w-px bg-white/10 shrink-0" />
          {toolbarSlot}
        </>
      ) : null}
    </div>
  );
}

export function LexicalToolbar({ toolbarSlot }: { toolbarSlot?: ReactNode }) {
  return (
    <div className="relative px-3 pt-2 pb-1 flex items-center">
      <ToolbarContent toolbarSlot={toolbarSlot} />
    </div>
  );
}

export function FloatingSelectionToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const isInteractingRef = useRef(false);

  const updatePosition = useCallback(() => {
    const domSelection = window.getSelection();
    const rootElement = editor.getRootElement();

    if (
      !domSelection ||
      domSelection.isCollapsed ||
      domSelection.rangeCount === 0 ||
      !rootElement
    ) {
      if (!isInteractingRef.current) {
        setIsVisible(false);
      }
      return;
    }

    const range = domSelection.getRangeAt(0);
    if (!rootElement.contains(range.commonAncestorContainer)) {
      if (!isInteractingRef.current) {
        setIsVisible(false);
      }
      return;
    }

    const text = domSelection.toString().trim();
    if (!text) {
      if (!isInteractingRef.current) {
        setIsVisible(false);
      }
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      if (!isInteractingRef.current) {
        setIsVisible(false);
      }
      return;
    }

    const toolbarHeight = 42;
    let top = rect.top - toolbarHeight - 8;
    if (top < 10) {
      top = rect.bottom + 8;
    }

    const left = Math.max(
      130,
      Math.min(window.innerWidth - 130, rect.left + rect.width / 2),
    );
    setCoords({ top, left });
    setIsVisible(true);
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updatePosition();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updatePosition();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [editor, updatePosition]);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isVisible) {
        updatePosition();
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible, updatePosition]);

  if (!isVisible || !coords) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
      className="pointer-events-auto select-none animate-in fade-in-0 zoom-in-95 duration-100"
    >
      <ToolbarContent
        onInteractionChange={(interacting) => {
          isInteractingRef.current = interacting;
          if (!interacting) {
            updatePosition();
          }
        }}
      />
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The message editor.
 *
 * What the user types is a real rich-text document — headings, lists, task
 * lists, quotes, code blocks, links, dividers, mention and command chips — and
 * what gets sent is the markdown that document serialises to. Both directions
 * run through the same transformer list, so nothing typed is lost on send and
 * nothing sent renders differently than it looked here.
 */
export function LexicalComposerInput({
  placeholder = 'Message channel…',
  onSend,
  enterToSend = true,
  onTyping,
  onEmptyChange,
  onDraftChange,
  onMentionsChange,
  disabled = false,
  autoFocus = false,
  initialMarkdown,
  showToolbar = true,
  hasPendingAttachments = false,
  members = [],
  channelMentions = [],
  slashCommands = [],
  onRegisterRef,
  onMentionTrigger,
  onMentionClose,
  toolbarSlot,
}: LexicalComposerInputProps) {
  /*
   * `LexicalComposer` consumes `initialConfig` once, at mount. Keeping it a
   * stable object (empty deps) rather than rebuilding it every time
   * `initialMarkdown` changes avoids a pointless re-memo on every conversation
   * switch — the draft for a conversation opened later is applied through the
   * imperative `setMarkdown`, not this seed.
   */
  const seedMarkdown = useRef(initialMarkdown);
  const initialConfig = useMemo(
    () => ({
      namespace: 'OneTabChatComposer',
      theme: EDITOR_THEME,
      onError: (error: Error) => console.error('Lexical error:', error),
      nodes: EDITOR_NODES,
      editorState: seedMarkdown.current
        ? () => {
            $convertFromMarkdownString(
              seedMarkdown.current as string,
              CHAT_TRANSFORMERS,
              undefined,
              true,
            );
          }
        : undefined,
    }),
    [],
  );

  const [mentionOpen, setMentionOpen] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const isMenuOpen = mentionOpen || channelMenuOpen || commandOpen;

  const handleMentionOpenChange = useCallback(
    (open: boolean) => {
      setMentionOpen(open);
      if (!open) onMentionClose?.();
    },
    [onMentionClose],
  );

  const handleCommandOpenChange = useCallback((open: boolean) => {
    setCommandOpen(open);
  }, []);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex flex-1 flex-col">
        {showToolbar ? <LexicalToolbar toolbarSlot={toolbarSlot} /> : null}
        <FloatingSelectionToolbar />

        <div className="px-3.5 py-2.5 relative flex-1">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isMenuOpen}
                aria-haspopup="listbox"
                aria-label="Message composer input"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="left-3.5 top-2.5 text-sm pointer-events-none absolute select-none text-subtle">
                    {placeholder}
                  </div>
                }
                className="min-h-6 max-h-[46vh] w-full resize-none overflow-y-auto overscroll-contain scrollbar-thin text-sm font-normal text-foreground outline-none"
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <ClickableLinkPlugin newTab />
        <AutoLinkPlugin matchers={AUTO_LINK_MATCHERS} />
        <HashtagPlugin />
        <HorizontalRulePlugin />
        <TabIndentationPlugin />
        <MarkdownShortcutPlugin transformers={CHAT_TRANSFORMERS} />
        {autoFocus ? <AutoFocusPlugin /> : null}

        <ChangeSignalsPlugin
          onTyping={onTyping}
          onEmptyChange={onEmptyChange}
          onDraftChange={onDraftChange}
          onMentionsChange={onMentionsChange}
        />
        <EditablePlugin disabled={disabled} />
        <FormattingShortcutsPlugin />
        <HtmlPastePlugin />
        <EditorApiPlugin
          onSend={onSend}
          onTyping={onTyping}
          onRegisterRef={onRegisterRef}
          hasPendingAttachments={hasPendingAttachments}
          enterToSend={enterToSend}
        />

        {members.length > 0 ? (
          <MentionsPlugin
            candidates={members}
            onOpenChange={handleMentionOpenChange}
            onQuery={onMentionTrigger}
          />
        ) : null}
        {channelMentions.length > 0 ? (
          <ChannelMentionsPlugin
            candidates={channelMentions}
            onOpenChange={setChannelMenuOpen}
          />
        ) : null}
        {slashCommands.length > 0 ? (
          <SlashCommandsPlugin
            commands={slashCommands}
            onOpenChange={handleCommandOpenChange}
          />
        ) : null}
        <EmojiPickerPlugin onOpenChange={() => undefined} />
      </div>
    </LexicalComposer>
  );
}
