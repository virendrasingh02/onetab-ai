import { Activity, MessageSquare, CheckCircle, FileText } from 'lucide-react';

export function ActivityTimelineView() {
  const activities = [
    { id: '1', user: 'Admin', action: 'completed task', target: 'Setup Qdrant Vector Collection', time: '10 minutes ago', icon: CheckCircle, color: 'text-emerald-400' },
    { id: '2', user: 'Dev User', action: 'updated document', target: 'Architecture Overview', time: '1 hour ago', icon: FileText, color: 'text-blue-400' },
    { id: '3', user: 'Dev User', action: 'commented on task', target: 'Kanban Board Interface', time: '2 hours ago', icon: MessageSquare, color: 'text-purple-400' },
  ];

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-purple-400" /> Activity Timeline & Stream
        </h1>
        <p className="text-sm text-slate-400">Real-time audit log of workspace events and team activity</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex-1">
        <div className="relative border-l border-slate-800 pl-6 space-y-6">
          {activities.map((act) => {
            const Icon = act.icon;
            return (
              <div key={act.id} className="relative">
                <div className="absolute -left-[31px] top-0 p-1.5 bg-slate-900 border border-slate-700 rounded-full">
                  <Icon className={`w-3.5 h-3.5 ${act.color}`} />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 max-w-xl">
                  <p className="text-sm text-slate-200">
                    <span className="font-semibold text-white">{act.user}</span> {act.action}{' '}
                    <span className="font-medium text-blue-400">{act.target}</span>
                  </p>
                  <span className="text-xs text-slate-400 mt-1 block">{act.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
