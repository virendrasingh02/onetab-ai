import React from 'react';
import type { AIAgentDetail } from '@org/types';
import { Button, Card, EmptyState } from '@org/ui';
import { Code2, Edit3, MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import { renderEntityIcon } from './MarketplaceCard';

interface MarketplaceMyItemsViewProps {
  type: 'agents' | 'apps';
  agents: AIAgentDetail[];
  onOpenBuilder: (agentId?: string, name?: string) => void;
  onOpenChat: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
  onToggleAgentStatus?: (agentId: string, currentStatus: string) => void;
  onOpenDeveloper: () => void;
}

export const MarketplaceMyItemsView: React.FC<MarketplaceMyItemsViewProps> = ({
  type,
  agents,
  onOpenBuilder,
  onOpenChat,
  onDeleteAgent,
  onToggleAgentStatus,
  onOpenDeveloper,
}) => {
  if (type === 'apps') {
    return (
      <div className="py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Custom Workspace Apps
            </h2>
            <p className="text-xs text-muted-foreground">
              Internal tools, webhooks, and private API integrations built by your team.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenDeveloper}
            className="text-xs font-semibold"
          >
            <Plus className="size-3.5 mr-1" />
            Register Custom App
          </Button>
        </div>

        <EmptyState
          title="No custom apps created yet"
          description="You can build private integrations using the Developer Portal with webhook triggers and API keys."
          action={
            <Button variant="outline" size="sm" onClick={onOpenDeveloper}>
              <Code2 className="size-3.5 mr-1" />
              Open Developer Portal
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Custom AI Agents ({agents.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Custom agents created within this workspace using the visual Agent Builder.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onOpenBuilder()}
          className="text-xs font-semibold"
        >
          <Plus className="size-3.5 mr-1" />
          Create New Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          title="No custom agents yet"
          description="Build tailored AI agents configured with your prompts, knowledge bases, and team tools."
          action={
            <Button variant="primary" size="sm" onClick={() => onOpenBuilder()}>
              <Sparkles className="size-3.5 mr-1" />
              Build Your First Agent
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className="p-5 flex flex-col justify-between border border-border/80 bg-surface rounded-2xl hover:shadow-xs transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {renderEntityIcon(agent.avatarUrl || 'icon:bot', 'AGENT', 'size-11')}
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {agent.name}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.role || 'Custom Assistant'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      agent.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {agent.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                  {agent.systemPrompt || agent.description || 'No system prompt defined.'}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4">
                  <span className="px-1.5 py-0.5 rounded bg-surface-raised border border-border/70 font-mono text-[10px]">
                    {agent.model || 'Default LLM'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onOpenChat(agent.id)}
                  className="text-xs"
                >
                  <MessageSquare className="size-3 mr-1" />
                  Chat
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onOpenBuilder(agent.id, agent.name)}
                    className="text-xs"
                  >
                    <Edit3 className="size-3 mr-1" />
                    Edit
                  </Button>

                  {onDeleteAgent && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onDeleteAgent(agent.id)}
                      className="text-xs text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
