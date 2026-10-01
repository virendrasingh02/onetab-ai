import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, CodeBlock, Input, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
  ExternalLink,
  MessageSquare,
  Send,
} from 'lucide-react';
import { deploymentService } from '../../services/deploymentService.js';

export function WidgetBuilder({ agent, onUpdate }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState(() => {
    return agent?.configuration?.widgetConfig || deploymentService.getWidgetConfig(agent.id);
  });
  const [previewInput, setPreviewInput] = useState('');
  const [previewMessages, setPreviewMessages] = useState([
    { role: 'assistant', text: config.welcomeMessage },
  ]);

  const handleSaveConfig = () => {
    deploymentService.saveWidgetConfig(agent.id, config);
    if (onUpdate) {
      onUpdate({
        configuration: {
          ...(typeof agent.configuration === 'object' ? agent.configuration : {}),
          widgetConfig: config,
        },
      });
    }
    toast.success('Chat widget styling & settings updated!');
  };

  const handleTestSend = (e) => {
    e.preventDefault();
    if (!previewInput.trim()) return;
    setPreviewMessages((prev) => [
      ...prev,
      { role: 'user', text: previewInput.trim() },
      {
        role: 'assistant',
        text: `[Live Widget Demo] I am ${agent.name}. I received your query: "${previewInput.trim()}".`,
      },
    ]);
    setPreviewInput('');
  };

  const embedSnippet = deploymentService.generateEmbedSnippet(agent.id, config);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <MessageSquare className="size-4" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Embeddable Web Chat Widget</h2>
            <Badge variant="outline" className="text-xs text-primary border-primary/30">
              Live Preview
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Customize the brand theme, welcome greetings, and embed script to deploy this agent on any external website.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/chat/${agent.id}`)}
            className="gap-1.5 text-xs text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
          >
            <ExternalLink className="size-3.5" />
            Open Fullpage Chat
          </Button>

          <Button size="sm" onClick={handleSaveConfig} className="text-xs font-semibold">
            Save Widget Config
          </Button>
        </div>
      </div>

      {/* 2-Column: Left Settings, Right Live Widget Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Customization Settings */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-3.5 text-xs">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Branding & Titles</h3>

            <div>
              <label className="text-[11px] font-semibold text-foreground">Widget Title</label>
              <Input
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground">Subtitle / Status</label>
              <Input
                value={config.subtitle}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground">Welcome Greeting Message</label>
              <textarea
                rows={2}
                value={config.welcomeMessage}
                onChange={(e) => {
                  setConfig({ ...config, welcomeMessage: e.target.value });
                  setPreviewMessages([{ role: 'assistant', text: e.target.value }]);
                }}
                className="mt-1 w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground">Accent Brand Color</label>
              <div className="flex items-center gap-2 mt-1.5">
                {['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setConfig({ ...config, primaryColor: color })}
                    className={cn(
                      'size-7 rounded-full border-2 transition-transform',
                      config.primaryColor === color ? 'scale-110 border-foreground shadow-md' : 'border-transparent',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Embed Script Snippet Card */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-2">
            <span className="text-xs font-bold text-foreground">HTML Embed Code</span>
            <CodeBlock
              code={embedSnippet}
              language="html"
              filename="widget-embed.html"
              maxHeight="220px"
            />
            <p className="text-[10px] text-muted-foreground">
              Paste this tag directly before the closing &lt;/body&gt; tag on your landing pages or SaaS portal.
            </p>
          </div>
        </div>

        {/* Right: Live Interactive Widget Mockup */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-zinc-900/60 p-6">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">Live Interactive Preview</div>

          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col h-[460px]">
            {/* Widget Head */}
            <div
              className="p-3.5 flex items-center justify-between text-white"
              style={{ backgroundColor: config.primaryColor }}
            >
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-white/20">
                  <Bot className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-none">{config.title}</div>
                  <div className="text-[10px] text-white/80 mt-0.5">{config.subtitle}</div>
                </div>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
              {previewMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-xl p-2.5 max-w-[85%] text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'ml-auto text-white rounded-tr-xs'
                      : 'bg-surface-raised border border-border text-foreground rounded-tl-xs',
                  )}
                  style={m.role === 'user' ? { backgroundColor: config.primaryColor } : {}}
                >
                  {m.text}
                </div>
              ))}
            </div>

            {/* Suggested Chips */}
            <div className="px-3 pb-2 flex gap-1 overflow-x-auto">
              {config.suggestedPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPreviewMessages((prev) => [
                      ...prev,
                      { role: 'user', text: p },
                      { role: 'assistant', text: `Resolution preview for: "${p}".` },
                    ]);
                  }}
                  className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[9px] text-muted-foreground whitespace-nowrap hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form onSubmit={handleTestSend} className="p-2.5 border-t border-border flex items-center gap-1.5 bg-surface">
              <input
                type="text"
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-surface-raised border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden"
              />
              <button
                type="submit"
                className="flex size-7 items-center justify-center rounded-lg text-white font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: config.primaryColor }}
              >
                <Send className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
