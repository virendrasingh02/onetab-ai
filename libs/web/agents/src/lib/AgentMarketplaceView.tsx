import { useState } from 'react';
import { Bot, Download, ShieldCheck, Cpu } from 'lucide-react';

export interface AgentCard {
  id: string;
  name: string;
  role: string;
  description: string;
  tools: string[];
  provider: string;
  installed?: boolean;
}

const marketplaceAgents: AgentCard[] = [
  { id: '1', name: 'Agile Sprint Manager', role: 'Scrum Master', description: 'Auto-summarizes task progress, flags overdue tasks, and organizes sprint backlogs.', tools: ['create_task', 'search_docs', 'send_channel_message'], provider: 'ollama' },
  { id: '2', name: 'Code Sentinel & Reviewer', role: 'Tech Lead', description: 'Reviews code pull requests, checks security issues, and writes documentation.', tools: ['search_docs', 'send_channel_message'], provider: 'openai' },
  { id: '3', name: 'Workspace Knowledge Curator', role: 'Docs Architect', description: 'Indexes workspace documents into RAG vector storage and answers queries.', tools: ['search_docs'], provider: 'anthropic' },
];

export function AgentMarketplaceView() {
  const [agents, setAgents] = useState<AgentCard[]>(marketplaceAgents);

  const toggleInstall = (id: string) => {
    setAgents(agents.map(a => a.id === id ? { ...a, installed: !a.installed } : a));
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-400" /> AI Agent Marketplace
          </h1>
          <p className="text-sm text-slate-400">Deploy specialized autonomous AI employees to your workspace</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">{agent.name}</h3>
                    <span className="text-[11px] text-slate-400">{agent.role}</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-purple-400" /> {agent.provider}
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">{agent.description}</p>
              
              <div className="flex flex-wrap gap-1 mb-4">
                {agent.tools.map(t => (
                  <span key={t} className="text-[10px] font-mono bg-slate-800/80 text-blue-400 px-2 py-0.5 rounded">
                    🛠 {t}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => toggleInstall(agent.id)}
              className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                agent.installed
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
              }`}
            >
              {agent.installed ? <ShieldCheck className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              {agent.installed ? 'Installed & Active' : 'Deploy to Workspace'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
