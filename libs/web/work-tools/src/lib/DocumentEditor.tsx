import { CodeNode } from '@lexical/code';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

import {
  Badge,
  Button,
  Card,
  Input,
  Page,
  PageHeader,
  Panel,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle,
  Code,
  FileText,
  Folder,
  Italic,
  List,
  ListOrdered,
  Plus,
  Quote,
  Redo,
  Save,
  Search,
  Strikethrough,
  Trash2,
  Underline,
  Undo,
} from 'lucide-react';
import { useState } from 'react';

// Lexical Theme styling for editor content
const theme = {
  paragraph: 'mb-2 leading-relaxed text-foreground',
  heading: {
    h1: 'text-2xl font-bold mb-3 mt-4 text-foreground border-b pb-1',
    h2: 'text-xl font-semibold mb-2 mt-3 text-foreground',
    h3: 'text-lg font-medium mb-2 mt-2 text-foreground',
  },
  list: {
    ul: 'list-disc pl-5 mb-3 space-y-1',
    ol: 'list-decimal pl-5 mb-3 space-y-1',
    listitem: 'text-sm text-foreground',
  },
  quote: 'border-l-4 border-primary/60 pl-3 italic my-3 text-muted-foreground bg-surface p-2 rounded-r-md',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline decoration-primary underline-offset-2',
    strikethrough: 'line-through opacity-80',
    code: 'font-mono bg-surface-raised px-1.5 py-0.5 rounded text-xs text-primary border border-border',
  },
};

// Lexical Custom Toolbar Component
function LexicalToolbar() {
  const [editor] = useLexicalComposerContext();

  const formatText = (command: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, command);
  };

  const formatElement = (command: 'left' | 'center' | 'right' | 'justify') => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, command);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-surface rounded-lg border border-border mb-3 select-none">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        title="Undo"
      >
        <Undo className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        title="Redo"
      >
        <Redo className="size-3.5" />
      </Button>

      <div className="h-4 w-px bg-border mx-1" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('underline')}
        title="Underline (Ctrl+U)"
      >
        <Underline className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('strikethrough')}
        title="Strikethrough"
      >
        <Strikethrough className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('code')}
        title="Inline Code"
      >
        <Code className="size-3.5" />
      </Button>

      <div className="h-4 w-px bg-border mx-1" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatElement('left')}
        title="Align Left"
      >
        <AlignLeft className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatElement('center')}
        title="Align Center"
      >
        <AlignCenter className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatElement('right')}
        title="Align Right"
      >
        <AlignRight className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatElement('justify')}
        title="Justify"
      >
        <AlignJustify className="size-3.5" />
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        <Badge variant="neutral" className="text-[10px] font-mono">
          Lexical Engine v0.38
        </Badge>
      </div>
    </div>
  );
}

export interface NoteItem {
  id: string;
  title: string;
  category: string;
  updatedAt: string;
  snippet: string;
}

const initialNotes: NoteItem[] = [
  {
    id: 'n1',
    title: 'Workspace Architecture Overview',
    category: 'Architecture',
    updatedAt: '10m ago',
    snippet: 'Lexical rich text integration and React 19 framework notes.',
  },
  {
    id: 'n2',
    title: 'Q3 Sprint Planning & Product Specs',
    category: 'Planning',
    updatedAt: '2h ago',
    snippet: 'Sprint goals, team assignments, and release timeline.',
  },
  {
    id: 'n3',
    title: 'Ollama Vector RAG Local Setup Guide',
    category: 'Dev Ops',
    updatedAt: 'Yesterday',
    snippet: 'Configuring Qdrant vector database collection embeddings.',
  },
];

export function DocumentEditor() {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [activeNoteId, setActiveNoteId] = useState('n1');
  const [activeTitle, setActiveTitle] = useState(
    'Workspace Architecture Overview',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const initialConfig = {
    namespace: 'OneTabNotesEditor',
    theme,
    onError: (error: Error) => {
      console.error('Lexical Editor Error:', error);
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode],
  };

  const createNewNote = () => {
    const newId = `note-${Date.now()}`;
    const newNote: NoteItem = {
      id: newId,
      title: 'Untitled Note',
      category: 'General',
      updatedAt: 'Just now',
      snippet: 'Start writing your note content here...',
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newId);
    setActiveTitle('Untitled Note');
  };

  const deleteNote = (id: string) => {
    const filtered = notes.filter((n) => n.id !== id);
    setNotes(filtered);
    if (filtered.length > 0) {
      setActiveNoteId(filtered[0].id);
      setActiveTitle(filtered[0].title);
    }
  };

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Page width="full">
      <PageHeader
        title="Notes"
        description="Rich text notes powered by Meta's Lexical framework with real-time formatting and workspace auto-sync."
        icon={<FileText />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            {isSaved ? (
              <Badge variant="primary" className="gap-1 px-3 py-1">
                <CheckCircle className="size-3.5" />
                Note Saved
              </Badge>
            ) : null}
            <Button
              leadingIcon={<Save />}
              onClick={() => {
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 3000);
              }}
            >
              Save Note
            </Button>
          </div>
        }
      />

      <div className="gap-6 md:flex-row flex flex-1 flex-col">
        {/* Left Notes List Panel */}
        <Panel
          className="md:w-72 w-full shrink-0 flex flex-col justify-between"
          title={
            <span className="gap-2 flex items-center">
              <Folder className="size-4 text-accent-blue" aria-hidden />
              <span>Notes Directory</span>
            </span>
          }
          actions={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New note"
              onClick={createNewNote}
            >
              <Plus className="size-4" />
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-subtle" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            <nav aria-label="Notes Directory">
              <ul className="space-y-1">
                {filteredNotes.map((note) => {
                  const isActive = note.id === activeNoteId;
                  return (
                    <li key={note.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNoteId(note.id);
                          setActiveTitle(note.title);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'p-2.5 text-xs flex flex-col w-full text-left rounded-lg transition-colors',
                          isActive
                            ? 'bg-selected/70 border border-primary/30 text-foreground font-medium'
                            : 'hover:bg-surface text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate text-foreground">
                            {note.title}
                          </span>
                          <span className="text-[10px] text-subtle font-mono">
                            {note.updatedAt}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground truncate opacity-80">
                          {note.snippet}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {notes.length > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4 text-xs text-muted-foreground hover:text-destructive gap-1.5"
              onClick={() => deleteNote(activeNoteId)}
            >
              <Trash2 className="size-3.5" />
              <span>Delete Current Note</span>
            </Button>
          ) : null}
        </Panel>

        {/* Right Lexical Rich Text Editor Area */}
        <Panel className="min-w-0 flex-1 flex flex-col bg-background">
          <Input
            value={activeTitle}
            onChange={(e) => {
              const val = e.target.value;
              setActiveTitle(val);
              setNotes((prev) =>
                prev.map((n) =>
                  n.id === activeNoteId ? { ...n, title: val } : n,
                ),
              );
            }}
            placeholder="Note title..."
            className="px-0 text-xl font-bold h-auto border-0 shadow-none focus-visible:ring-0 text-foreground mb-3"
          />

          <LexicalComposer initialConfig={initialConfig}>
            <div className="flex flex-col flex-1 min-h-[450px]">
              <LexicalToolbar />
              <div className="relative flex-1 p-4 rounded-xl border border-border bg-surface focus-within:border-primary/60 transition-colors">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable className="min-h-[400px] outline-none text-sm leading-relaxed text-foreground" />
                  }
                  placeholder={
                    <div className="absolute top-4 left-4 text-sm text-subtle pointer-events-none italic">
                      Start writing your notes with Lexical rich text controls...
                    </div>
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <ListPlugin />
                <AutoFocusPlugin />
              </div>
            </div>
          </LexicalComposer>
        </Panel>
      </div>
    </Page>
  );
}
