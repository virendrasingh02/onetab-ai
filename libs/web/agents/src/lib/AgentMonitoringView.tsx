import { Activity, CheckCircle, Wrench } from 'lucide-react';

export function AgentMonitoringView() {
  const logs = [
    { id: 'log_1', agent: 'Agile Sprint Manager', prompt: 'Audit task backlog and summarize sprint status', status: 'SUCCESS', toolUsed: 'search_docs', tokens: 184, time: '5 mins ago' },
    { id: 'log_2', agent: 'Code Sentinel & Reviewer', prompt: 'Inspect PR #42 security patches', status: 'SUCCESS', toolUsed: 'create_task', tokens: 210, time: '20 mins ago' },
    { id: 'log_3', agent: 'Workspace Knowledge Curator', prompt: 'Re-index modified documentation into Qdrant vector collection', status: 'SUCCESS', toolUsed: 'search_docs', tokens: 140, time: '1 hour ago' },
  ];

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-emerald-400" /> Agent Telemetry & Monitoring
        </h1>
        <p className="text-sm text-slate-400">Live tool call traces, execution audit logs, and token usage analytics</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Task Prompt</th>
              <th className="px-4 py-3">Tool Call</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tokens</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/40 transition">
                <td className="px-4 py-3 font-semibold text-slate-200">{log.agent}</td>
                <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{log.prompt}</td>
                <td className="px-4 py-3 font-mono text-xs text-purple-400 flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5" /> {log.toolUsed}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium flex items-center gap-1 w-fit">
                    <CheckCircle className="w-3 h-3" /> {log.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.tokens}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
