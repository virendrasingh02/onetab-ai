import { Activity, CheckCircle } from 'lucide-react';

export function WorkflowExecutionLogsView() {
  const executions = [
    { id: 'exec_1', workflow: 'GitHub Webhook -> AI Code Review -> Matrix Alert', trigger: 'WEBHOOK', status: 'SUCCESS', stepsExecuted: 4, duration: '480ms', time: '10 mins ago' },
    { id: 'exec_2', workflow: 'Daily Standup Summary Generator', trigger: 'CRON', status: 'SUCCESS', stepsExecuted: 3, duration: '1.2s', time: '4 hours ago' },
    { id: 'exec_3', workflow: 'Overdue Task Escalation Bot', trigger: 'EVENT', status: 'SUCCESS', stepsExecuted: 2, duration: '120ms', time: '1 day ago' },
  ];

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-emerald-400" /> Workflow Execution Logs
        </h1>
        <p className="text-sm text-slate-400">Audit logs, step-by-step payloads, and execution run timings</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Workflow</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Steps</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {executions.map((exec) => (
              <tr key={exec.id} className="hover:bg-slate-800/40 transition">
                <td className="px-4 py-3 font-semibold text-slate-200">{exec.workflow}</td>
                <td className="px-4 py-3 font-mono text-xs text-amber-400">{exec.trigger}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{exec.stepsExecuted} nodes</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium flex items-center gap-1 w-fit">
                    <CheckCircle className="w-3 h-3" /> {exec.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{exec.duration}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{exec.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
