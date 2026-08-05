import { useState } from 'react';
import { Workflow, Save, Plus, Webhook, GitBranch, Cpu, Globe } from 'lucide-react';

export interface CanvasNode {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
}

export function WorkflowCanvasView() {
  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: '1', type: 'WEBHOOK', title: '1. Webhook Trigger', subtitle: 'POST /api/v1/automations/webhook/xyz', icon: 'Webhook' },
    { id: '2', type: 'CONDITION', title: '2. Check Event Type', subtitle: 'if payload.action == "created"', icon: 'GitBranch' },
    { id: '3', type: 'AI_ACTION', title: '3. AI Summarizer', subtitle: 'Summarize issue body via Ollama Llama3', icon: 'Cpu' },
    { id: '4', type: 'API_CALL', title: '4. Matrix Channel Alert', subtitle: 'POST payload to #general', icon: 'Send' },
  ]);

  const addNode = (type: string, title: string) => {
    const newNode: CanvasNode = {
      id: String(Date.now()),
      type,
      title: `${nodes.length + 1}. ${title}`,
      subtitle: 'Configured step',
      icon: type === 'API_CALL' ? 'Globe' : 'Cpu',
    };
    setNodes([...nodes, newNode]);
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="w-6 h-6 text-amber-400" /> Visual Workflow Builder
          </h1>
          <p className="text-sm text-slate-400">Drag & drop triggers, condition filters, webhooks, and AI actions</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-sm shadow">
          <Save className="w-4 h-4" /> Save Workflow
        </button>
      </div>

      {/* Node Graph Surface */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col items-center gap-4 relative overflow-x-auto min-h-[420px]">
        {nodes.map((node, index) => (
          <div key={node.id} className="flex flex-col items-center">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-80 shadow-lg hover:border-amber-500/50 transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-950 text-amber-400 border border-amber-500/30 rounded-lg">
                  {node.type === 'WEBHOOK' && <Webhook className="w-5 h-5" />}
                  {node.type === 'CONDITION' && <GitBranch className="w-5 h-5 text-blue-400" />}
                  {node.type === 'AI_ACTION' && <Cpu className="w-5 h-5 text-purple-400" />}
                  {node.type === 'API_CALL' && <Globe className="w-5 h-5 text-emerald-400" />}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-100 text-sm">{node.title}</h4>
                  <p className="text-xs text-slate-400 font-mono truncate">{node.subtitle}</p>
                </div>
              </div>
            </div>

            {index < nodes.length - 1 && (
              <div className="h-6 w-0.5 bg-amber-500/40 my-1 relative">
                <div className="w-2 h-2 rounded-full bg-amber-400 absolute bottom-0 -left-[3px]" />
              </div>
            )}
          </div>
        ))}

        {/* Add Step Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => addNode('CONDITION', 'Filter Condition')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1 border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" /> Condition Node
          </button>
          <button
            onClick={() => addNode('AI_ACTION', 'AI Agent Step')}
            className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-300 text-xs rounded-lg flex items-center gap-1 border border-purple-500/30"
          >
            <Plus className="w-3.5 h-3.5" /> AI Action Node
          </button>
          <button
            onClick={() => addNode('API_CALL', 'Outgoing Webhook')}
            className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs rounded-lg flex items-center gap-1 border border-emerald-500/30"
          >
            <Plus className="w-3.5 h-3.5" /> HTTP Webhook Node
          </button>
        </div>
      </div>
    </div>
  );
}
