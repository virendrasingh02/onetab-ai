import { useState } from 'react';
import { FileText, Save, Plus, Folder, Hash, AlignLeft, Code, List } from 'lucide-react';

export function DocumentEditor() {
  const [docTitle, setDocTitle] = useState('Workspace Architecture & Knowledge Base');
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
`
  );

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col md:flex-row gap-6">
      {/* Sidebar Doc Tree */}
      <div className="w-full md:w-64 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Folder className="w-4 h-4 text-blue-400" /> Documents & Wiki
          </span>
          <button className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1 text-sm text-slate-300">
          <div className="px-2 py-1.5 bg-slate-800 rounded-lg flex items-center gap-2 text-blue-400 font-medium">
            <FileText className="w-4 h-4" /> Architecture Overview
          </div>
          <div className="px-2 py-1.5 hover:bg-slate-800/60 rounded-lg flex items-center gap-2 text-slate-400 cursor-pointer">
            <FileText className="w-4 h-4" /> Local Setup Guide
          </div>
          <div className="px-2 py-1.5 hover:bg-slate-800/60 rounded-lg flex items-center gap-2 text-slate-400 cursor-pointer">
            <FileText className="w-4 h-4" /> API Endpoints Reference
          </div>
        </div>
      </div>

      {/* Editor Main Surface */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="text-xl font-bold bg-transparent text-white focus:outline-none focus:border-b focus:border-blue-500 w-full"
          />
          <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800/60 text-slate-400 text-xs">
          <button className="p-1.5 hover:bg-slate-800 hover:text-white rounded flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Heading</button>
          <button className="p-1.5 hover:bg-slate-800 hover:text-white rounded flex items-center gap-1"><AlignLeft className="w-3.5 h-3.5" /> Paragraph</button>
          <button className="p-1.5 hover:bg-slate-800 hover:text-white rounded flex items-center gap-1"><List className="w-3.5 h-3.5" /> List</button>
          <button className="p-1.5 hover:bg-slate-800 hover:text-white rounded flex items-center gap-1"><Code className="w-3.5 h-3.5" /> Code</button>
        </div>

        <textarea
          value={docContent}
          onChange={(e) => setDocContent(e.target.value)}
          className="w-full flex-1 bg-slate-950/40 border border-slate-800/80 rounded-lg p-4 font-mono text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none min-h-[350px]"
        />
      </div>
    </div>
  );
}
