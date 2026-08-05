import { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';

export function AIChatView() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Welcome to OneTab AI Chat! Ask me to write code, summarize documents, plan sprints, or query vector memories.' },
  ]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'ollama' | 'openai' | 'anthropic' | 'gemini'>('ollama');

  const handleSend = () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `[Response from ${provider.toUpperCase()}] I have processed your input: "${userText}". Here is the structured AI synthesis.`,
        },
      ]);
    }, 500);
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" /> AI Workspace Chat
          </h1>
          <p className="text-sm text-slate-400">Multi-provider conversational AI engine</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none"
          >
            <option value="ollama">Ollama (Local Llama 3)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="anthropic">Anthropic (Claude 3.5)</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[450px]">
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl text-sm leading-relaxed max-w-2xl ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white ml-auto'
                  : 'bg-slate-800 border border-slate-700/60 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-400 mb-1">
                {m.role === 'assistant' ? <Bot className="w-4 h-4 text-purple-400" /> : null}
                <span>{m.role === 'user' ? 'You' : `AI (${provider.toUpperCase()})`}</span>
              </div>
              <p>{m.content}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <input
            type="text"
            placeholder="Type a message or prompt..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
          />
          <button onClick={handleSend} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
