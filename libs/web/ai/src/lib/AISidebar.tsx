import { useState } from 'react';
import { X, Send, Sparkles, Cpu } from 'lucide-react';

export interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: 'Hello! I am your OneTab AI Copilot. How can I help you with your workspace today?' },
  ]);
  const [provider, setProvider] = useState<'ollama' | 'openai' | 'anthropic' | 'gemini'>('ollama');

  if (!isOpen) return null;

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `[Copilot via ${provider.toUpperCase()}] I processed your request: "${userMsg}". Here is the workspace synthesis.`,
        },
      ]);
    }, 600);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white">AI Copilot</h2>
            <p className="text-[11px] text-slate-400">Omnipresent Workspace AI</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Provider Selector */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/30 flex items-center gap-2 text-xs">
        <Cpu className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-slate-400">Provider:</span>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as any)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none"
        >
          <option value="ollama">Ollama (Local LLM)</option>
          <option value="openai">OpenAI (GPT-4o)</option>
          <option value="anthropic">Anthropic (Claude 3.5)</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg text-xs leading-relaxed max-w-[85%] ${
              m.role === 'user'
                ? 'bg-blue-600 text-white ml-auto'
                : 'bg-slate-800 border border-slate-700/60 text-slate-200'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      {/* Input Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask AI anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleSend}
          className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
