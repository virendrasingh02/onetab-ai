import { useState } from 'react';
import { Plus, CheckSquare, User } from 'lucide-react';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeName?: string;
  dueDate?: string;
}

const initialTasks: TaskItem[] = [
  { id: '1', title: 'Setup Qdrant Vector Collection', description: 'Configure workspace_docs collection for RAG embeddings', status: 'DONE', priority: 'HIGH', assigneeName: 'Admin' },
  { id: '2', title: 'Implement Kanban Board Interface', description: 'Build drag-and-drop task columns for agile management', status: 'IN_PROGRESS', priority: 'URGENT', assigneeName: 'Dev User' },
  { id: '3', title: 'Connect Ollama Model Runner', description: 'Enable local LLM inference with nomic-embed-text', status: 'TODO', priority: 'MEDIUM', assigneeName: 'Dev User' },
  { id: '4', title: 'Document & Wiki Hierarchy', description: 'Notion-like block editor and page nesting', status: 'TODO', priority: 'HIGH' },
];

export function KanbanBoard() {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeColumn, setActiveColumn] = useState<'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'>('TODO');
  const [showModal, setShowModal] = useState(false);

  const columns: Array<{ id: TaskItem['status']; title: string; color: string }> = [
    { id: 'TODO', title: 'To Do', color: 'border-slate-500 text-slate-400' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-500 text-blue-400' },
    { id: 'IN_REVIEW', title: 'In Review', color: 'border-purple-500 text-purple-400' },
    { id: 'DONE', title: 'Done', color: 'border-emerald-500 text-emerald-400' },
  ];

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: TaskItem = {
      id: Date.now().toString(),
      title: newTaskTitle,
      status: activeColumn,
      priority: 'MEDIUM',
      assigneeName: 'You',
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setShowModal(false);
  };

  const moveTask = (taskId: string, newStatus: TaskItem['status']) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-500" /> Tasks & Kanban Board
          </h1>
          <p className="text-sm text-slate-400">ClickUp & Notion style task management</p>
        </div>
        <button
          onClick={() => { setActiveColumn('TODO'); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-md transition"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <span className={`font-semibold border-l-4 pl-2 ${col.color}`}>{col.title}</span>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.map((task) => (
                  <div key={task.id} className="bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 rounded-lg p-3 transition shadow-sm">
                    <h3 className="font-medium text-slate-100 text-sm mb-1">{task.title}</h3>
                    {task.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{task.description}</p>}
                    
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {task.assigneeName ?? 'Unassigned'}</span>
                      <div className="flex gap-1">
                        {columns.filter(c => c.id !== col.id).map(c => (
                          <button key={c.id} onClick={() => moveTask(task.id, c.id)} className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-slate-300">
                            → {c.title[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Create New Task</h2>
            <input
              type="text"
              placeholder="Task Title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white mb-4 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
              <button onClick={handleAddTask} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
