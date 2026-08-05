import { useState } from 'react';
import { Layout, Plus, Trash2 } from 'lucide-react';

export interface CanvasNode {
  id: string;
  title: string;
  x: number;
  y: number;
  color: string;
}

export function WhiteboardCanvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: '1', title: 'User Auth Module', x: 80, y: 100, color: 'bg-blue-600' },
    { id: '2', title: 'Ollama AI Runner', x: 320, y: 100, color: 'bg-purple-600' },
    { id: '3', title: 'Qdrant Vector DB', x: 320, y: 240, color: 'bg-emerald-600' },
  ]);

  const addNode = () => {
    const newNode: CanvasNode = {
      id: Date.now().toString(),
      title: 'New Flow Node',
      x: 150 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      color: 'bg-amber-600',
    };
    setNodes([...nodes, newNode]);
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layout className="w-6 h-6 text-purple-400" /> Interactive Whiteboard & Diagramming
          </h1>
          <p className="text-sm text-slate-400">Canvas for node flows, architecture diagrams & visual brainstorming</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addNode} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium text-white shadow">
            <Plus className="w-4 h-4" /> Add Node
          </button>
        </div>
      </div>

      <div className="relative flex-1 bg-slate-900/60 border border-slate-800 rounded-xl min-h-[500px] overflow-hidden p-6 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Render Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line x1={180} y1={120} x2={320} y2={120} stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1={400} y1={150} x2={400} y2={240} stroke="#475569" strokeWidth="2" strokeDasharray="4" />
        </svg>

        {/* Render Canvas Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            style={{ left: `${node.x}px`, top: `${node.y}px` }}
            className={`absolute p-4 rounded-xl border border-slate-700/60 text-white shadow-lg w-48 transition hover:scale-105 cursor-grab ${node.color}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span>{node.title}</span>
              <button
                onClick={() => setNodes(nodes.filter((n) => n.id !== node.id))}
                className="p-1 hover:bg-black/20 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-white/80">Interactive canvas element</p>
          </div>
        ))}
      </div>
    </div>
  );
}
