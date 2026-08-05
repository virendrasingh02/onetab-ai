import { useState } from 'react';
import { Workflow, Plus, Play, Webhook, Clock } from 'lucide-react';

export interface WorkflowItem {
  id: string;
  name: string;
  triggerType: string;
  isActive: boolean;
  totalExecutions: number;
  lastRun: string;
}

const sampleWorkflows: WorkflowItem[] = [
  { id: 'wf_1', name: 'GitHub Webhook -> AI Code Review -> Matrix Alert', triggerType: 'WEBHOOK', isActive: true, totalExecutions: 42, lastRun: '12 mins ago' },
  { id: 'wf_2', name: 'Daily Standup Summary Generator', triggerType: 'CRON', isActive: true, totalExecutions: 15, lastRun: '4 hours ago' },
  { id: 'wf_3', name: 'Overdue Task Escalation Bot', triggerType: 'EVENT', isActive: false, totalExecutions: 8, lastRun: '1 day ago' },
];

export function WorkflowListView() {
  const [workflows] = useState<WorkflowItem[]>(sampleWorkflows);

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="w-6 h-6 text-amber-400" /> No-Code Workflow Automations
          </h1>
          <p className="text-sm text-slate-400">Automate workspace tasks, webhooks, AI agent steps, and integrations</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-sm shadow">
          <Plus className="w-4 h-4" /> Create Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {workflows.map((wf) => (
          <div key={wf.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-500/30 rounded flex items-center gap-1">
                  {wf.triggerType === 'WEBHOOK' ? <Webhook className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {wf.triggerType}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${wf.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  {wf.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
              <h3 className="font-bold text-slate-100 text-sm mb-2">{wf.name}</h3>
              <div className="text-xs text-slate-400 flex items-center gap-4 mb-4">
                <span>Runs: <strong className="text-white">{wf.totalExecutions}</strong></span>
                <span>Last run: <strong className="text-white">{wf.lastRun}</strong></span>
              </div>
            </div>

            <button className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-2 transition">
              <Play className="w-3.5 h-3.5 text-emerald-400" /> Run Workflow Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
