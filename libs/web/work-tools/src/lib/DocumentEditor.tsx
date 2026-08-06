import {
  Button,
  Input,
  Page,
  PageHeader,
  Panel,
  Textarea,
  Toolbar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlignLeft,
  Code,
  FileText,
  Folder,
  Hash,
  List,
  Plus,
  Save,
} from 'lucide-react';
import { useState } from 'react';

const DOCUMENTS = [
  { id: 'architecture', title: 'Architecture overview' },
  { id: 'setup', title: 'Local setup guide' },
  { id: 'api', title: 'API endpoints reference' },
];

const BLOCK_ACTIONS = [
  { id: 'heading', label: 'Heading', icon: Hash },
  { id: 'paragraph', label: 'Paragraph', icon: AlignLeft },
  { id: 'list', label: 'List', icon: List },
  { id: 'code', label: 'Code', icon: Code },
];

export function DocumentEditor() {
  const [activeDoc, setActiveDoc] = useState('architecture');
  const [docTitle, setDocTitle] = useState(
    'Workspace architecture & knowledge base',
  );
  const [docContent, setDocContent] = useState(
    `# OneTab AI Architecture Overview

Welcome to the central knowledge base for OneTab AI.

## Core Modules & Services
- **Tasks & Kanban**: Agile task tracking and sprint planning.
- **Documents & Wiki**: Notion-like nested docs and knowledge bases.
- **Local AI & Vector RAG**: Powered by local Ollama LLMs and Qdrant.
- **Real-Time Communication**: Powered by Matrix protocol.

### Technical Stack
\`\`\`typescript
const techStack = {
  frontend: 'React 19 + Redux Toolkit + Vite',
  backend: 'NestJS + Prisma + PostgreSQL',
  ai: 'Ollama + Qdrant Vector Store',
};
\`\`\`
`,
  );

  return (
    <Page width="full">
      <PageHeader
        title="Documents"
        description="Nested docs and wikis for your workspace knowledge base."
        icon={<FileText />}
        accent="blue"
        actions={<Button leadingIcon={<Save />}>Save</Button>}
      />

      <div className="gap-6 md:flex-row flex flex-1 flex-col">
        <Panel
          className="md:w-64 w-full shrink-0"
          title={
            <span className="gap-2 flex items-center">
              <Folder className="size-4 text-accent-blue" aria-hidden />
              Pages
            </span>
          }
          actions={
            <Button variant="ghost" size="icon-sm" aria-label="New document">
              <Plus />
            </Button>
          }
        >
          {/* A real nav list, so the document tree is reachable by keyboard. */}
          <nav aria-label="Documents">
            <ul className="space-y-0.5">
              {DOCUMENTS.map((doc) => {
                const isActive = doc.id === activeDoc;
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => setActiveDoc(doc.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'gap-2 px-2 py-1.5 text-sm flex w-full items-center rounded-lg text-left',
                        'transition-colors duration-(--duration-fast)',
                        'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                        isActive
                          ? 'font-medium bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <FileText className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{doc.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Panel>

        <Panel className="min-w-0 flex-1">
          <label htmlFor="doc-title" className="sr-only">
            Document title
          </label>
          <Input
            id="doc-title"
            value={docTitle}
            onChange={(event) => setDocTitle(event.target.value)}
            className="px-0 text-lg font-semibold h-auto border-0 shadow-none focus-visible:ring-0"
          />

          <Toolbar
            aria-label="Insert block"
            className="my-3 py-2 border-y text-muted-foreground"
          >
            {BLOCK_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                size="sm"
                leadingIcon={<action.icon />}
              >
                {action.label}
              </Button>
            ))}
          </Toolbar>

          <label htmlFor="doc-body" className="sr-only">
            Document body
          </label>
          <Textarea
            id="doc-body"
            value={docContent}
            onChange={(event) => setDocContent(event.target.value)}
            className="min-h-88 text-sm resize-none font-mono"
          />
        </Panel>
      </div>
    </Page>
  );
}
