import { useState } from 'react';
import { Sparkles, Send, Bookmark } from 'lucide-react';

export function ExtensionPopup() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);

  const handleAskAI = () => {
    if (!prompt) return;
    setResponse(`OneTab AI: Processed prompt "${prompt}". Workspace synchronized!`);
  };

  return (
    <div className="w-80 bg-slate-950 text-white p-4 font-sans border border-slate-800 rounded-xl">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
        <Sparkles className="w-5 h-5 text-blue-400" />
        <h3 className="font-bold text-sm">OneTab AI Browser Companion</h3>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask AI or capture page content..."
        rows={3}
        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none mb-3"
      />

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleAskAI}
          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 shadow"
        >
          <Send className="w-3.5 h-3.5" /> Ask AI
        </button>
        <button className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1">
          <Bookmark className="w-3.5 h-3.5" /> Save Page
        </button>
      </div>

      {response && (
        <div className="p-2.5 bg-slate-900 border border-blue-500/30 rounded-lg text-xs text-blue-300">
          {response}
        </div>
      )}
    </div>
  );
}
