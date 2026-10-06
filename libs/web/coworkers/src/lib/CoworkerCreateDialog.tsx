import type { AICoworkerDetail, CoworkerPermissions } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  AIProviderIcon,
  AIModelIcon,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { AgentBuilderOptionsProvider, useAgentBuilderOptions, useAgents } from '@org/web-agents';
import {
  Bot,
  Brain,
  Check,
  Code2,
  Globe,
  Layers,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { type FC, useEffect, useState } from 'react';
import { CoworkerAvatar } from './CoworkerAvatar.js';
import { useCoworkerMutations } from './use-coworkers.js';

export interface CoworkerCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  coworker?: AICoworkerDetail | null;
}

const PRESET_ICONS = [
  { id: 'icon:bot', label: 'Bot', icon: Bot },
  { id: 'icon:brain', label: 'Brain', icon: Brain },
  { id: 'icon:code', label: 'Code', icon: Code2 },
  { id: 'icon:spark', label: 'Sparkles', icon: Sparkles },
  { id: 'icon:shield', label: 'Shield', icon: Shield },
  { id: 'icon:search', label: 'Search', icon: Search },
  { id: 'icon:chat', label: 'Chat', icon: MessageSquare },
  { id: 'icon:rocket', label: 'Rocket', icon: Rocket },
  { id: 'icon:globe', label: 'Globe', icon: Globe },
  { id: 'icon:zap', label: 'Zap', icon: Zap },
];

/** Reads a coworker always has; everything else is opted into below. */
const BASE_READ_TOOLS = ['search_docs', 'list_projects', 'list_tasks', 'list_channels', 'list_memory'];

export const CoworkerCreateDialog: FC<CoworkerCreateDialogProps> = ({
  open,
  onOpenChange,
  workspaceId,
  coworker,
}) => {
  const isEditing = !!coworker;
  const mutations = useCoworkerMutations(workspaceId);
  const { data: availableAgents } = useAgents(workspaceId);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('icon:bot');
  const [personality, setPersonality] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');
  // Empty means the workspace default model — what the runtime uses when a
  // coworker names no provider/model of its own.
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [knowledgeAccess, setKnowledgeAccess] = useState(true);
  const [allowedActions, setAllowedActions] = useState<string[]>([
    'search_docs',
    'list_projects',
    'list_tasks',
    'list_channels',
  ]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (coworker) {
      setName(coworker.name);
      setRole(coworker.role);
      setDescription(coworker.description || '');
      setAvatarUrl(coworker.avatarUrl || 'icon:bot');
      setPersonality(coworker.personality || '');
      setWelcomeMessage(coworker.welcomeMessage || '');
      setSystemInstructions(coworker.systemInstructions || '');
      setProvider(coworker.provider || '');
      setModel(coworker.model || '');
      setKnowledgeAccess(coworker.permissions?.knowledgeAccess ?? true);
      setAllowedActions(
        (coworker.permissions?.allowActions ?? []).filter((id) => !BASE_READ_TOOLS.includes(id)),
      );
      setSelectedAgentIds(
        coworker.agentLinks?.map((link) => link.agentId) || [],
      );
    } else {
      setName('');
      setRole('AI Coworker');
      setDescription('');
      setAvatarUrl('icon:bot');
      setPersonality('Collaborative, analytical, proactive, and clear.');
      setWelcomeMessage('');
      setSystemInstructions(
        'You are a persistent AI coworker in the workspace. You assist team members across channels, review project deliverables, suggest workflow improvements, and consult specialized agents when deep domain knowledge is needed.',
      );
      setProvider('');
      setModel('');
      setKnowledgeAccess(true);
      setAllowedActions([]);
      setSelectedAgentIds([]);
    }
  }, [coworker, open]);

  const toggleAction = (actionId: string) => {
    setAllowedActions((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId],
    );
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Coworker name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const permissions: CoworkerPermissions = {
        knowledgeAccess,
        allowActions: allowedActions,
      };

      if (isEditing && coworker) {
        await mutations.update.mutateAsync({
          coworkerId: coworker.id,
          input: {
            name: name.trim(),
            role: role.trim() || 'AI Coworker',
            description: description.trim() || undefined,
            avatarUrl,
            personality: personality.trim() || undefined,
            welcomeMessage: welcomeMessage.trim() || undefined,
            systemInstructions: systemInstructions.trim(),
            ...(provider ? { provider } : {}),
            ...(model ? { model } : {}),
            permissions,
          },
        });

        // Sync linked agents
        const currentLinked = coworker.agentLinks?.map((l) => l.agentId) || [];
        const toAdd = selectedAgentIds.filter((id) => !currentLinked.includes(id));
        const toRemove = currentLinked.filter((id) => !selectedAgentIds.includes(id));

        for (const agentId of toAdd) {
          await mutations.linkAgent.mutateAsync({
            coworkerId: coworker.id,
            agentId,
          });
        }
        for (const agentId of toRemove) {
          await mutations.unlinkAgent.mutateAsync({
            coworkerId: coworker.id,
            agentId,
          });
        }

        toast.success(`Updated coworker ${name}`);
      } else {
        await mutations.create.mutateAsync({
          name: name.trim(),
          role: role.trim() || 'AI Coworker',
          description: description.trim() || undefined,
          avatarUrl,
          personality: personality.trim() || undefined,
          welcomeMessage: welcomeMessage.trim() || undefined,
          systemInstructions: systemInstructions.trim(),
          ...(provider ? { provider } : {}),
          ...(model ? { model } : {}),
          permissions,
          agentIds: selectedAgentIds,
        });
        toast.success(`Created AI Coworker "${name}"`);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save coworker',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AgentBuilderOptionsProvider workspaceId={open ? workspaceId : undefined}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-surface border-border rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle className="text-lg font-bold">
            {isEditing ? `Edit Coworker: ${coworker?.name}` : 'Create AI Coworker'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure a persistent AI teammate with dedicated identity, model,
            permissions, and sub-agent delegation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <ScrollArea className="max-h-[65vh] px-6 py-4 space-y-6">
            {/* Identity section */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
                Teammate Identity
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Maya Lin, Alex Chen, DevBot"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Role / Job Title
                  </label>
                  <Input
                    placeholder="e.g. Senior Staff Engineer, Product Architect"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Brief Bio / Mission
                </label>
                <Input
                  placeholder="e.g. Helps teams with TypeScript migrations, architecture RFCs, and PR reviews."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Avatar Preset Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Avatar Icon / Style
                </label>
                <div className="flex items-center gap-3">
                  <CoworkerAvatar
                    name={name || 'AI'}
                    avatarUrl={avatarUrl}
                    size="lg"
                    showStatusDot={false}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_ICONS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAvatarUrl(preset.id)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors',
                          avatarUrl === preset.id
                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                            : 'border-border/60 hover:bg-muted text-muted-foreground',
                        )}
                        title={preset.label}
                      >
                        <preset.icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Persona & System Instructions */}
            <div className="space-y-4 pt-4 border-t border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-primary" />
                Persona & Instructions
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tone & Personality
                </label>
                <Input
                  placeholder="e.g. Friendly, highly structured, offers counter-arguments constructively."
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Welcome Message (optional)
                </label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] leading-relaxed resize-y"
                  placeholder="Shown as the first message when someone opens a DM with this coworker, e.g. &quot;Hi, I'm your AI coworker — tell me what you're working on.&quot;"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  System Instructions (Prompt)
                </label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring min-h-[90px] font-mono leading-relaxed resize-y"
                  placeholder="Detailed guidelines, response constraints, and domain conventions..."
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {/* Model & Runtime */}
            <div className="space-y-4 pt-4 border-t border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Model & Provider
              </h3>

              <ProviderModelFields
                provider={provider}
                model={model}
                onProviderChange={(next) => {
                  setProvider(next);
                  setModel('');
                }}
                onModelChange={setModel}
              />
            </div>

            {/* Permissions & Tool Guardrails */}
            <div className="space-y-4 pt-4 border-t border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Permissions & Tool Access
              </h3>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Workspace Knowledge Access (RAG)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Allows coworker to search documents, discussions, and project boards.
                  </p>
                </div>
                <Switch
                  checked={knowledgeAccess}
                  onCheckedChange={setKnowledgeAccess}
                />
              </div>

              <ToolPicker allowed={allowedActions} onToggle={toggleAction} />
            </div>

            {/* Delegated Sub-Agents */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Delegate Sub-Agents
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select which workspace AI Agents this coworker can consult or delegate to.
                </p>
              </div>

              {availableAgents && availableAgents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableAgents.map((agent) => {
                    const isSelected = selectedAgentIds.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => toggleAgent(agent.id)}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors',
                          isSelected
                            ? 'border-violet-500 bg-violet-500/10 text-foreground'
                            : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/30',
                        )}
                      >
                        <div className="truncate">
                          <p className="font-medium truncate">{agent.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {agent.role}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-violet-500 shrink-0 ml-1.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic rounded-lg border border-dashed border-border p-3 text-center">
                  No other agents found in this workspace to delegate to.
                </p>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-3 border-t border-border/60 bg-muted/20 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-2 font-medium"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Coworker'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </AgentBuilderOptionsProvider>
    </Dialog>
  );
};

/**
 * Provider and model from the workspace's configured providers — the same
 * list the agent builder uses. This used to be a fixed list that included
 * "google", which is not a provider id the runtime knows, so a coworker set
 * to it failed on its first message.
 */
function ProviderModelFields({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: {
  provider: string;
  model: string;
  onProviderChange: (value: string) => void;
  onModelChange: (value: string) => void;
}) {
  const { options, isLoading } = useAgentBuilderOptions();
  const models = options.models.filter((m) => m.group === provider);
  const DEFAULT = '__default__';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Provider">
        <Select value={provider || DEFAULT} onValueChange={(v) => onProviderChange(v === DEFAULT ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? 'Loading…' : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>Workspace default</SelectItem>
            {options.providers.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <div className="flex items-center gap-2">
                  <AIProviderIcon provider={p.value} size={15} />
                  <span>
                    {p.label}
                    {p.hint ? ' — not configured' : ''}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Model" hint={provider ? undefined : 'Uses the workspace default model.'}>
        <Select value={model || DEFAULT} onValueChange={(v) => onModelChange(v === DEFAULT ? '' : v)} disabled={!provider}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>Provider default</SelectItem>
            {model && !models.some((m) => m.value === model) ? (
              <SelectItem value={model}>
                <div className="flex items-center gap-2">
                  <AIModelIcon modelId={model} provider={provider} size={15} />
                  <span>{model}</span>
                </div>
              </SelectItem>
            ) : null}
            {models.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <div className="flex items-center gap-2">
                  <AIModelIcon modelId={m.value} provider={provider} size={15} />
                  <span>{m.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

/** Tools beyond the always-on reads, from the real tool list (built-ins and MCP servers). */
function ToolPicker({ allowed, onToggle }: { allowed: string[]; onToggle: (id: string) => void }) {
  const { options, isLoading } = useAgentBuilderOptions();
  const tools = options.tools.filter((t) => !BASE_READ_TOOLS.includes(t.value));
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-foreground">Extra tools</legend>
      <p className="text-[11px] text-muted-foreground">
        It can always search documents and list projects, tasks and channels. Pick what else it may do.
      </p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading tools…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tools.map((tool) => {
            const isChecked = allowed.includes(tool.value);
            return (
              <button
                key={tool.value}
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => onToggle(tool.value)}
                title={tool.hint}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isChecked
                    ? 'border-primary/50 bg-primary/5 text-foreground'
                    : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/30',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11px]">{tool.label}</span>
                  {tool.group ? <span className="block text-[10px] text-muted-foreground">{tool.group}</span> : null}
                </span>
                {isChecked ? <Check className="ml-1.5 h-3.5 w-3.5 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
