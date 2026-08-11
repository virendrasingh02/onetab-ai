import { CodeHighlightNode, CodeNode } from '@lexical/code';
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical';
import {
  AtSign,
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  SquareCode,
  Strikethrough,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';

const EDITOR_THEME = {
  paragraph: 'mb-1 last:mb-0 leading-normal',
  text: {
    bold: 'font-bold text-white',
    italic: 'italic text-slate-200',
    strikethrough: 'line-through text-slate-400',
    code: 'rounded bg-[#1e1f22] px-1.5 py-0.5 font-mono text-xs text-[#00a8fc]',
  },
  list: {
    ul: 'list-disc pl-5 my-1 text-[#dbdee1]',
    ol: 'list-decimal pl-5 my-1 text-[#dbdee1]',
    listitem: 'my-0.5',
    checklist: 'pl-2 my-1',
  },
  quote: 'border-l-4 border-[#5865f2] pl-3 py-1 my-1 text-slate-300 italic bg-[#1e1f22]/50 rounded-r',
  code: 'block rounded-lg bg-[#1e1f22] p-2.5 font-mono text-xs text-[#22c55e] border border-[#35373c] my-1',
};

export interface LexicalComposerInputProps {
  placeholder?: string;
  onSend: (text: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  onRegisterRef?: (ref: LexicalEditorRef) => void;
  onMentionTrigger?: (query: string) => void;
  onMentionClose?: () => void;
}

export interface LexicalEditorRef {
  insertText: (text: string) => void;
  replaceMentionQuery: (name: string) => void;
  clear: () => void;
}

function EnterKeyPlugin({
  onSend,
  onTyping,
}: {
  onSend: (text: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event && !event.shiftKey) {
          event.preventDefault();

          let textToSend = '';
          editor.getEditorState().read(() => {
            textToSend = $getRoot().getTextContent().trim();
          });

          if (textToSend) {
            editor.update(() => {
              $getRoot().clear();
              $getRoot().append($createParagraphNode());
            });
            onTyping?.(false);
            void onSend(textToSend);
          }
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onSend, onTyping]);

  return null;
}

function EditorRefPlugin({ onRegisterRef }: { onRegisterRef?: (ref: LexicalEditorRef) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onRegisterRef) return;

    onRegisterRef({
      insertText: (text: string) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertText(text);
          } else {
            const root = $getRoot();
            const lastChild = root.getLastChild();
            if (lastChild && $isElementNode(lastChild)) {
              lastChild.append($createTextNode(text));
            } else {
              const p = $createParagraphNode();
              p.append($createTextNode(text));
              root.append(p);
            }
          }
        });
      },
      replaceMentionQuery: (name: string) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const anchor = selection.anchor;
            const node = anchor.getNode();
            if ($isTextNode(node)) {
              const text = node.getTextContent();
              const lastAt = text.lastIndexOf('@');
              if (lastAt !== -1) {
                const updatedText = text.slice(0, lastAt) + `@${name} `;
                node.setTextContent(updatedText);
                return;
              }
            }
          }
          const root = $getRoot();
          const lastChild = root.getLastChild();
          if (lastChild && $isElementNode(lastChild)) {
            lastChild.append($createTextNode(`@${name} `));
          } else {
            const p = $createParagraphNode();
            p.append($createTextNode(`@${name} `));
            root.append(p);
          }
        });
      },
      clear: () => {
        editor.update(() => {
          $getRoot().clear();
          $getRoot().append($createParagraphNode());
        });
      },
    });
  }, [editor, onRegisterRef]);

  return null;
}

/**
 * Live Mention Detector Plugin: triggers autocomplete popover when typing `@`
 */
function MentionDetectPlugin({
  onMentionTrigger,
  onMentionClose,
}: {
  onMentionTrigger?: (query: string) => void;
  onMentionClose?: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const text = $getRoot().getTextContent();
        const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(text);
        if (match) {
          onMentionTrigger?.(match[1] || '');
        } else if (!text.includes('@')) {
          onMentionClose?.();
        }
      });
    });
  }, [editor, onMentionTrigger, onMentionClose]);

  return null;
}

export function LexicalToolbar({ onMentionTrigger }: { onMentionTrigger?: (query: string) => void }) {
  const [editor] = useLexicalComposerContext();

  const formatText = useCallback(
    (format: 'bold' | 'italic' | 'strikethrough' | 'code') => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    [editor],
  );

  const insertBulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const insertNumberedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const insertChecklist = useCallback(() => {
    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
  }, [editor]);

  const insertQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText('> ');
      }
    });
  }, [editor]);

  const insertCodeBlock = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText('```\n\n```');
      }
    });
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 border-b border-[#2b2d31] bg-[#2b2d31] px-2 py-1 text-[#949ba4] overflow-x-auto">
      <button
        type="button"
        onClick={() => formatText('bold')}
        title="Bold (Ctrl+B)"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <Bold className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => formatText('italic')}
        title="Italic (Ctrl+I)"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <Italic className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => formatText('strikethrough')}
        title="Strikethrough"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <Strikethrough className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => formatText('code')}
        title="Inline Code"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <Code className="size-3.5" />
      </button>

      <span className="mx-1 h-3.5 w-px bg-[#3f4147]" />

      <button
        type="button"
        onClick={insertBulletList}
        title="Bulleted List"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <List className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={insertNumberedList}
        title="Numbered List"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <ListOrdered className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={insertChecklist}
        title="Task Checklist"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <ListTodo className="size-3.5" />
      </button>

      <span className="mx-1 h-3.5 w-px bg-[#3f4147]" />

      <button
        type="button"
        onClick={insertQuote}
        title="Blockquote (>)"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <Quote className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={insertCodeBlock}
        title="Code Block (```)"
        className="rounded p-1 hover:bg-[#35373c] hover:text-white transition-colors"
      >
        <SquareCode className="size-3.5" />
      </button>

      <span className="mx-1 h-3.5 w-px bg-[#3f4147]" />

      <button
        type="button"
        onClick={() => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText('@');
            }
          });
          onMentionTrigger?.('');
        }}
        title="Mention Member (@)"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-[#5865f2] hover:bg-[#5865f2]/20 transition-colors"
      >
        <AtSign className="size-3.5" />
        <span>Mention</span>
      </button>
    </div>
  );
}

export function LexicalComposerInput({
  placeholder = 'Message channel...',
  onSend,
  onTyping,
  onRegisterRef,
  onMentionTrigger,
  onMentionClose,
}: LexicalComposerInputProps) {
  const initialConfig = {
    namespace: 'DiscordLexicalChat',
    theme: EDITOR_THEME,
    onError: (error: Error) => console.error('Lexical Error:', error),
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
    ],
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex flex-1 flex-col">
        <LexicalToolbar onMentionTrigger={onMentionTrigger} />
        <div className="relative flex-1 px-3 py-2">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-label="Message composer input"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="pointer-events-none absolute top-2 left-3 text-sm text-[#80848e]">
                    {placeholder}
                  </div>
                }
                className="max-h-48 min-h-[44px] w-full resize-none text-sm font-normal text-[#dbdee1] outline-none placeholder:text-[#80848e]"
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <OnChangePlugin
          onChange={() => {
            onTyping?.(true);
          }}
        />
        <EnterKeyPlugin onSend={onSend} onTyping={onTyping} />
        <EditorRefPlugin onRegisterRef={onRegisterRef} />
        <MentionDetectPlugin onMentionTrigger={onMentionTrigger} onMentionClose={onMentionClose} />
      </div>
    </LexicalComposer>
  );
}
