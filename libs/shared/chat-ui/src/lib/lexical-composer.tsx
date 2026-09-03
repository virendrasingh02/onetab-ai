import {
  $createCodeNode,
  $isCodeNode,
  CodeHighlightNode,
  CodeNode,
} from '@lexical/code';
import { HashtagNode } from '@lexical/hashtag';
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
import {
  HorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  type HeadingTagType,
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
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  IS_APPLE,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import {
  AtSign,
  Blocks,
  Bold,
  Bot,
  Check,
  Code,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Slash,
  Smile,
  SquareCode,
  Strikethrough,
} from 'lucide-react';
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
import { CHAT_TRANSFORMERS } from './lexical-markdown.js';
import {
  $createCommandNode,
  $createMentionNode,
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

/** Someone (or something) a `@` mention can point at. */
export interface MentionCandidate {
  id: string;
  /** Display name, without the leading `@`. */
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  /** Group mentions (`@here`, `@channel`) are listed above people, AI agents and apps have distinct badges. */
  kind?: 'user' | 'group' | 'agent' | 'app';
  badge?: string;
}

export interface LexicalComposerInputProps {
  placeholder?: string;
  onSend: (text: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
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
  replaceMentionQuery: (name: string, id?: string) => void;
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
}: {
  onSend: (text: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onRegisterRef?: (ref: LexicalEditorRef) => void;
  hasPendingAttachments?: boolean;
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
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
    });
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
        // Shift+Enter is the line break. Everything else sends — the typeahead
        // menus claim Enter at CRITICAL priority while they are open, so this
        // only ever runs when no menu is showing.
        if (!event || event.shiftKey) return false;
        event.preventDefault();
        return send();
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, send]);

  useEffect(() => {
    if (!onRegisterRef) return;

    onRegisterRef({
      insertText: (text) => insertNodesAtCaret(() => [$createTextNode(text)]),

      insertMention: (candidate) =>
        insertNodesAtCaret(() => [
          $createMentionNode(candidate.name, candidate.id),
          $createTextNode(' '),
        ]),

      replaceMentionQuery: (name, id) => {
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

          $insertNodes([$createMentionNode(name, id), $createTextNode(' ')]);
        });
      },

      setMarkdown: (markdown) => {
        editor.update(() => {
          $convertFromMarkdownString(
            markdown,
            CHAT_TRANSFORMERS,
            undefined,
            true,
          );
        });
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
function MenuShell({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`left-0 mb-2 absolute bottom-full z-120 ${MENU_CLASS}`}>
      <div className="px-3 py-1.5 font-bold tracking-wider flex items-center justify-between border-b border-border text-[10px] uppercase">
        <span className="gap-1.5 flex items-center text-primary-text">
          {icon}
          <span>{label}</span>
        </span>
        {hint ? <span className="text-subtle">{hint}</span> : null}
      </div>
      <ul className="max-h-64 p-1 overflow-y-auto">{children}</ul>
    </div>
  );
}

function MenuItem({
  option,
  isSelected,
  onSelect,
  onHighlight,
  children,
}: {
  option: MenuOption;
  isSelected: boolean;
  onSelect: () => void;
  onHighlight: () => void;
  children: ReactNode;
}) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      ref={option.setRefElement.bind(option)}
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
    return candidates
      .filter(
        (candidate) =>
          !needle ||
          candidate.name.toLowerCase().includes(needle) ||
          candidate.subtitle?.toLowerCase().includes(needle),
      )
      .slice(0, 12)
      .map((candidate) => new MentionMenuOption(candidate));
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
        if (!anchorRef.current || options.length === 0) return null;

        const groups = options.filter((o) => o.candidate.kind === 'group');
        const agents = options.filter((o) => o.candidate.kind === 'agent');
        const apps = options.filter((o) => o.candidate.kind === 'app');
        const people = options.filter(
          (o) => !o.candidate.kind || o.candidate.kind === 'user',
        );

        const renderOption = (option: MentionMenuOption) => {
          const index = options.indexOf(option);
          const isAgent = option.candidate.kind === 'agent';
          const isApp = option.candidate.kind === 'app';
          const isGroup = option.candidate.kind === 'group';

          return (
            <MenuItem
              key={option.key}
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
              ) : isApp ? (
                <span className="size-6 bg-accent-violet-soft text-accent-violet border-accent-violet/20 flex shrink-0 items-center justify-center rounded-full border">
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
                  {isAgent ? (
                    <Badge
                      variant="primary"
                      className="py-0 h-3.5 font-bold tracking-wider text-[9px] uppercase"
                    >
                      AI AGENT
                    </Badge>
                  ) : isApp ? (
                    <Badge
                      variant="neutral"
                      className="py-0 h-3.5 font-bold tracking-wider bg-accent-violet-soft text-accent-violet border-accent-violet/20 text-[9px] uppercase"
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
            hint="↑↓ to browse · ↵ to insert"
            icon={<AtSign className="size-3.5" />}
          >
            {groups.length > 0 ? (
              <li className="px-2 py-1 font-bold text-[10px] text-subtle uppercase">
                Group mentions
              </li>
            ) : null}
            {groups.map(renderOption)}

            {agents.length > 0 ? (
              <li className="mt-1 px-2 py-1 font-bold text-[10px] text-primary uppercase">
                AI Agents — {agents.length}
              </li>
            ) : null}
            {agents.map(renderOption)}

            {apps.length > 0 ? (
              <li className="mt-1 px-2 py-1 font-bold text-accent-violet text-[10px] uppercase">
                Connected Apps — {apps.length}
              </li>
            ) : null}
            {apps.map(renderOption)}

            {people.length > 0 ? (
              <li className="mt-1 px-2 py-1 font-bold text-[10px] text-subtle uppercase">
                People — {people.length}
              </li>
            ) : null}
            {people.map(renderOption)}
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
        if (!anchorRef.current || options.length === 0) return null;

        return createPortal(
          <MenuShell
            label="Commands"
            hint="↵ to pick"
            icon={<Slash className="size-3.5" />}
          >
            {options.map((option, index) => (
              <MenuItem
                key={option.key}
                option={option}
                isSelected={selectedIndex === index}
                onHighlight={() => setHighlightedIndex(index)}
                onSelect={() => selectOptionAndCleanUp(option)}
              >
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
            ))}
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

const TOOL_BUTTON =
  'flex size-7 shrink-0 items-center justify-center rounded transition-colors';

function ToolButton({
  label,
  isActive = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      disabled={disabled}
      // Formatting must not steal the caret, or there is nothing to format.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`${TOOL_BUTTON} ${
        isActive
          ? 'bg-primary/20 text-primary-text'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      } disabled:pointer-events-none disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-3.5 w-px shrink-0 bg-border" />;
}

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
export function LexicalToolbar({ toolbarSlot }: { toolbarSlot?: ReactNode }) {
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

  const syncToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setFormats({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      strikethrough: selection.hasFormat('strikethrough'),
      code: selection.hasFormat('code'),
      highlight: selection.hasFormat('highlight'),
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
    } else if ($isHeadingNode(element)) {
      const tag = element.getTag();
      setBlockType(
        tag === 'h1' || tag === 'h2' || tag === 'h3' ? tag : 'paragraph',
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

  const setBlock = useCallback(
    (next: BlockType) => {
      // Clicking the active block type returns to plain text, so every button
      // is a toggle rather than a one-way trip.
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
              : target === 'paragraph'
                ? $createParagraphNode()
                : $createHeadingNode(target as HeadingTagType),
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
    <div className="bg-surface-removed">
      <div className="gap-0.5 px-2 py-1 flex scrollbar-none items-center overflow-x-auto rounded-[inherit]">
        <ToolButton
          label="Bold (Ctrl+B)"
          isActive={formats.bold}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        >
          <Bold className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Italic (Ctrl+I)"
          isActive={formats.italic}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        >
          <Italic className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Strikethrough (Ctrl+Shift+X)"
          isActive={formats.strikethrough}
          onClick={() =>
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
          }
        >
          <Strikethrough className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Inline code (Ctrl+Shift+C)"
          isActive={formats.code}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        >
          <Code className="size-3.5" />
        </ToolButton>
        <ToolButton
          label={isLink ? 'Remove link' : 'Add link ([text](url))'}
          isActive={isLink}
          onClick={() => {
            if (isLink) {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
              return;
            }
            setLinkDraft((current) => (current === null ? '' : null));
          }}
        >
          {isLink ? (
            <Link2Off className="size-3.5" />
          ) : (
            <Link2 className="size-3.5" />
          )}
        </ToolButton>

        {/* <Divider />

        <ToolButton
          label="Heading 1 (# )"
          isActive={blockType === 'h1'}
          onClick={() => setBlock('h1')}
        >
          <Heading1 className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Heading 2 (## )"
          isActive={blockType === 'h2'}
          onClick={() => setBlock('h2')}
        >
          <Heading2 className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Heading 3 (### )"
          isActive={blockType === 'h3'}
          onClick={() => setBlock('h3')}
        >
          <Heading3 className="size-3.5" />
        </ToolButton> */}

        <Divider />

        <ToolButton
          label="Bulleted list (Ctrl+Shift+8)"
          isActive={blockType === 'ul'}
          onClick={() => setBlock('ul')}
        >
          <List className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Numbered list (Ctrl+Shift+7)"
          isActive={blockType === 'ol'}
          onClick={() => setBlock('ol')}
        >
          <ListOrdered className="size-3.5" />
        </ToolButton>
        {/* <ToolButton
          label="Task list (- [ ] )"
          isActive={blockType === 'check'}
          onClick={() => setBlock('check')}
        >
          <ListTodo className="size-3.5" />
        </ToolButton> */}

        <Divider />

        <ToolButton
          label="Blockquote (Ctrl+Shift+9)"
          isActive={blockType === 'quote'}
          onClick={() => setBlock('quote')}
        >
          <Quote className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Code block (```)"
          isActive={blockType === 'code'}
          onClick={() => setBlock('code')}
        >
          <SquareCode className="size-3.5" />
        </ToolButton>
        {/* <ToolButton
          label="Divider (---)"
          onClick={() =>
            editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
          }
        >
          <Minus className="size-3.5" />
        </ToolButton> */}

        {/* <Divider />

        <ToolButton
          label="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        >
          <Undo2 className="size-3.5" />
        </ToolButton>
        <ToolButton
          label="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        >
          <Redo2 className="size-3.5" />
        </ToolButton> */}

        {toolbarSlot ? (
          <>
            <Divider />
            {toolbarSlot}
          </>
        ) : null}
      </div>

      {linkDraft !== null ? (
        <div className="gap-1.5 px-2 py-1.5 flex items-center border-t border-border bg-surface-raised">
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={linkInputRef}
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
            placeholder="Paste or type a link, then press Enter"
            aria-label="Link URL"
            className="min-w-0 text-xs flex-1 bg-transparent text-foreground outline-none placeholder:text-subtle"
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyLink}
            className={`${TOOL_BUTTON} text-primary-text hover:bg-accent`}
            aria-label="Apply link"
          >
            <Check className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
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
  onTyping,
  disabled = false,
  autoFocus = false,
  initialMarkdown,
  showToolbar = true,
  hasPendingAttachments = false,
  members = [],
  slashCommands = [],
  onRegisterRef,
  onMentionTrigger,
  onMentionClose,
  toolbarSlot,
}: LexicalComposerInputProps) {
  const initialConfig = useMemo(
    () => ({
      namespace: 'OneTabChatComposer',
      theme: EDITOR_THEME,
      onError: (error: Error) => console.error('Lexical error:', error),
      nodes: EDITOR_NODES,
      editorState: initialMarkdown
        ? () => {
            $convertFromMarkdownString(
              initialMarkdown,
              CHAT_TRANSFORMERS,
              undefined,
              true,
            );
          }
        : undefined,
    }),
    [initialMarkdown],
  );

  const handleMentionOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onMentionClose?.();
    },
    [onMentionClose],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex flex-1 flex-col">
        {showToolbar ? <LexicalToolbar toolbarSlot={toolbarSlot} /> : null}

        <div className="px-3 py-2 relative flex-1">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-label="Message composer input"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="top-2 left-3 text-sm pointer-events-none absolute text-subtle">
                    {placeholder}
                  </div>
                }
                className="max-h-64 min-h-11 text-sm font-normal w-full resize-none overflow-y-auto text-foreground outline-none"
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

        <OnChangePlugin
          ignoreSelectionChange
          onChange={() => onTyping?.(true)}
        />
        <EditablePlugin disabled={disabled} />
        <FormattingShortcutsPlugin />
        <EditorApiPlugin
          onSend={onSend}
          onTyping={onTyping}
          onRegisterRef={onRegisterRef}
          hasPendingAttachments={hasPendingAttachments}
        />

        {members.length > 0 ? (
          <MentionsPlugin
            candidates={members}
            onOpenChange={handleMentionOpenChange}
            onQuery={onMentionTrigger}
          />
        ) : null}
        {slashCommands.length > 0 ? (
          <SlashCommandsPlugin
            commands={slashCommands}
            onOpenChange={() => undefined}
          />
        ) : null}
        <EmojiPickerPlugin onOpenChange={() => undefined} />
      </div>
    </LexicalComposer>
  );
}
