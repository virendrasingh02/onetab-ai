import { CodeNode } from '@lexical/code';
import { ListItemNode, ListNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import {
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

import {
  Badge,
  Button,
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
  Plus,
  Redo,
  Save,
  Search,
  Strikethrough,
  Trash2,
  Underline,
  Undo,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDocsState } from './docs/docs-hook.js';

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
      <div className="w-px h-4 bg-border mx-1" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('bold')}
        title="Bold"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('italic')}
        title="Italic"
      >
        <Italic className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => formatText('underline')}
        title="Underline"
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
        title="Code"
      >
        <Code className="size-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />

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
    </div>
  );
}

export function DocumentEditor() {
  const [searchParams] = useSearchParams();
  const {
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    updateDocTitle,
    createDoc,
    deleteDoc,
  } = useDocsState();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Sync active document with URL search parameters
  useEffect(() => {
    const docParam = searchParams.get('doc');
    const newDocParam = searchParams.get('newDoc');

    if (docParam && docs.some((d) => d.id === docParam)) {
      setActiveDocId(docParam);
    }

    if (newDocParam === 'true') {
      createDoc();
    }
  }, [searchParams, docs, setActiveDocId, createDoc]);

  const initialConfig = {
    namespace: 'OneTabDocsEditor',
    theme,
    onError: (error: Error) => {
      console.error('Lexical Editor Error:', error);
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode],
  };

  const filteredDocs = docs.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Page width="full">
      <PageHeader
        title="Docs"
        description="Rich text workspace documentation powered by Meta's Lexical framework with real-time formatting and auto-sync."
        icon={<FileText />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            {isSaved ? (
              <Badge variant="primary" className="gap-1 px-3 py-1">
                <CheckCircle className="size-3.5" />
                Document Saved
              </Badge>
            ) : null}
            <Button
              leadingIcon={<Save />}
              onClick={() => {
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 3000);
              }}
            >
              Save Doc
            </Button>
          </div>
        }
      />

      <div className="gap-6 md:flex-row flex flex-1 flex-col">
        {/* Left Docs Directory Panel */}
        <Panel
          className="md:w-72 w-full shrink-0 flex flex-col justify-between"
          title={
            <span className="gap-2 flex items-center">
              <Folder className="size-4 text-accent-blue" aria-hidden />
              <span>Docs Directory</span>
            </span>
          }
          actions={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New doc"
              onClick={() => createDoc()}
            >
              <Plus className="size-4" />
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-subtle" />
              <Input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            <nav aria-label="Docs Directory">
              <ul className="space-y-1">
                {filteredDocs.map((docItem) => {
                  const isActive = docItem.id === activeDocId;
                  return (
                    <li key={docItem.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setActiveDocId(docItem.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'p-2.5 text-xs flex flex-col w-full text-left rounded-lg transition-colors',
                          isActive
                            ? 'bg-selected font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-foreground truncate pr-4">
                            {docItem.title}
                          </span>
                          <span className="text-[10px] text-subtle shrink-0">
                            {docItem.updatedAt}
                          </span>
                        </div>
                        <p className="text-[11px] text-subtle line-clamp-1 mt-0.5">
                          {docItem.snippet}
                        </p>
                      </button>

                      {docs.length > 1 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDoc(docItem.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2.5 text-subtle hover:text-destructive p-1 rounded"
                          title="Delete Document"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </Panel>

        {/* Right Editor Main Workspace */}
        <Panel className="flex-1 flex flex-col min-h-128">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
            <Input
              value={activeDoc.title}
              onChange={(e) => updateDocTitle(activeDoc.id, e.target.value)}
              className="text-lg font-bold bg-transparent border-none p-0 focus-visible:ring-0 shadow-none h-auto text-foreground"
              placeholder="Document Title..."
            />
            <Badge variant="outline" className="text-[10px] uppercase">
              {activeDoc.category}
            </Badge>
          </div>

          {/* Lexical Framework Composer */}
          <LexicalComposer key={activeDoc.id} initialConfig={initialConfig}>
            <div className="relative flex-1 flex flex-col">
              <LexicalToolbar />

              <div className="relative flex-1 bg-surface-raised rounded-lg border border-border p-4 min-h-80">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable className="outline-none min-h-64 text-sm text-foreground space-y-2" />
                  }
                  placeholder={
                    <div className="absolute top-6 left-6 text-subtle text-sm pointer-events-none select-none">
                      Write document markdown content, design specs, or engineering guides...
                    </div>
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <ListPlugin />
              </div>
            </div>
          </LexicalComposer>
        </Panel>
      </div>
    </Page>
  );
}
