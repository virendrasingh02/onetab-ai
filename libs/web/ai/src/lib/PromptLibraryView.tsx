import { useState } from 'react';
import { BookOpen, Copy, Check } from 'lucide-react';

export interface PromptTemplateItem {
  id: string;
  title: string;
  category: string;
  promptText: string;
}

const defaultPrompts: PromptTemplateItem[] = [
  { id: '1', title: 'Sprint Review Summary Generator', category: 'Project Management', promptText: 'Analyze the following tasks and generate a 3-bullet sprint executive summary for stakeholders:' },
  { id: '2', title: 'Bug Fix & Code Review', category: 'Development', promptText: 'Review the following TypeScript code block for potential null pointer errors and memory leaks:' },
  { id: '3', title: 'Product Requirements Spec (PRD)', category: 'Product', promptText: 'Structure a PRD document containing Goals, User Stories, Acceptance Criteria, and Tech Architecture for:' },
];

export function PromptLibraryView() {
  const [prompts] = useState<PromptTemplateItem[]>(defaultPrompts);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" /> Prompt Library & Templates
          </h1>
          <p className="text-sm text-slate-400">Pre-built and custom team prompt templates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {prompts.map((p) => (
          <div key={p.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <span className="text-[10px] font-semibold uppercase bg-slate-800 text-blue-400 px-2 py-0.5 rounded">{p.category}</span>
              <h3 className="font-semibold text-slate-100 text-sm mt-2 mb-2">{p.title}</h3>
              <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 font-mono line-clamp-3">{p.promptText}</p>
            </div>
            <button
              onClick={() => handleCopy(p.id, p.promptText)}
              className="mt-4 flex items-center justify-center gap-2 w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition"
            >
              {copiedId === p.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === p.id ? 'Copied to Clipboard' : 'Use Prompt'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
