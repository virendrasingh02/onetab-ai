import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  LoadingState,
  ScrollArea,
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import type { AgentSkillBinding, SkillPackage } from '@org/types';
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Cpu,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStudioSession } from '../../session-guard.js';
import { AgentTabPage } from './agent-tab-page.js';

interface AgentSkillsTabProps {
  agent: { id: string; name: string; configuration?: any };
  onChanged?: () => void;
}

export function AgentSkillsTab({ agent, onChanged }: AgentSkillsTabProps) {
  const { activeWorkspace } = useStudioSession();
  const [assignedSkills, setAssignedSkills] = useState<AgentSkillBinding[]>([]);
  const [allSkills, setAllSkills] = useState<SkillPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addFilterQuery, setAddFilterQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Load assigned skills for this agent and all available workspace skills
  const loadSkills = useCallback(async () => {
    if (!activeWorkspace?.id || !agent?.id) return;
    setLoading(true);
    try {
      const [assignedRes, allRes] = await Promise.all([
        fetch(`/api/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/skills`),
        fetch(`/api/v1/workspaces/${activeWorkspace.id}/skills`),
      ]);

      if (assignedRes.ok) {
        const assignedData = await assignedRes.json();
        setAssignedSkills(assignedData || []);
      }
      if (allRes.ok) {
        const allData = await allRes.json();
        setAllSkills(allData || []);
      }
    } catch (err) {
      toast.error('Failed to load agent skills portfolio.');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, agent?.id]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Map skill id to skill package
  const skillsMap = useMemo(() => {
    const map = new Map<string, SkillPackage>();
    for (const skill of allSkills) {
      map.set(skill.id, skill);
    }
    return map;
  }, [allSkills]);

  // Save the full updated bindings array
  const persistSkills = async (updated: AgentSkillBinding[]) => {
    if (!activeWorkspace?.id || !agent?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: updated }),
      });
      if (!res.ok) throw new Error('Failed to update agent skills.');
      const data = await res.json();
      setAssignedSkills(data);
      onChanged?.();
      toast.success('Agent skills updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update agent skills.');
      loadSkills();
    } finally {
      setSaving(false);
    }
  };

  // Toggle skill active/disabled
  const handleToggle = (skillId: string, currentEnabled: boolean) => {
    const updated = assignedSkills.map((s) =>
      s.skillId === skillId ? { ...s, enabled: !currentEnabled } : s,
    );
    setAssignedSkills(updated);
    persistSkills(updated);
  };

  // Reorder skill up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const copy = [...assignedSkills];
    const prev = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = prev;
    const reindexed = copy.map((item, idx) => ({ ...item, priority: idx + 1 }));
    setAssignedSkills(reindexed);
    persistSkills(reindexed);
  };

  // Reorder skill down
  const handleMoveDown = (index: number) => {
    if (index >= assignedSkills.length - 1) return;
    const copy = [...assignedSkills];
    const next = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = next;
    const reindexed = copy.map((item, idx) => ({ ...item, priority: idx + 1 }));
    setAssignedSkills(reindexed);
    persistSkills(reindexed);
  };

  // Remove skill
  const handleRemove = async (skillId: string) => {
    if (!activeWorkspace?.id || !agent?.id) return;
    try {
      const res = await fetch(
        `/api/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/skills/${skillId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to remove skill.');
      const data = await res.json();
      setAssignedSkills(data);
      onChanged?.();
      toast.success('Skill detached from agent.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to detach skill.');
    }
  };

  // Add skill to agent
  const handleAddSkill = async (skillId: string) => {
    if (!activeWorkspace?.id || !agent?.id) return;
    try {
      const res = await fetch(
        `/api/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/skills/${skillId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: assignedSkills.length + 1 }),
        },
      );
      if (!res.ok) throw new Error('Failed to assign skill.');
      const data = await res.json();
      setAssignedSkills(data);
      setAddDialogOpen(false);
      onChanged?.();
      toast.success('Skill assigned to agent.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign skill.');
    }
  };

  // Filter assigned skills
  const filteredAssigned = useMemo(() => {
    if (!searchQuery.trim()) return assignedSkills;
    const q = searchQuery.toLowerCase();
    return assignedSkills.filter((b) => {
      const meta = skillsMap.get(b.skillId);
      return (
        b.skillId.toLowerCase().includes(q) ||
        meta?.name.toLowerCase().includes(q) ||
        meta?.description.toLowerCase().includes(q) ||
        meta?.category.toLowerCase().includes(q)
      );
    });
  }, [assignedSkills, skillsMap, searchQuery]);

  // Unassigned available skills for the dialog
  const unassignedAvailableSkills = useMemo(() => {
    const assignedIds = new Set(assignedSkills.map((s) => s.skillId));
    let available = allSkills.filter((s) => !assignedIds.has(s.id));
    if (addFilterQuery.trim()) {
      const q = addFilterQuery.toLowerCase();
      available = available.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return available;
  }, [allSkills, assignedSkills, addFilterQuery]);

  if (loading) {
    return <LoadingState label="Loading agent skills portfolio…" />;
  }

  return (
    <AgentTabPage
      title="Universal AI Skills Portfolio"
      description={`Specialized capabilities, instruction sets, sandboxed scripts, and tool-calling skills assigned to ${agent.name}. The agent runtime prioritizes these skills during reasoning and task execution.`}
      icon={<Sparkles className="size-5 text-primary" />}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setAddFilterQuery('');
            setAddDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" />
          Assign Skill
        </Button>
      }
    >
      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Filter assigned skills…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground self-start sm:self-auto">
          <span>
            Total assigned: <strong className="text-foreground">{assignedSkills.length}</strong>
          </span>
          <span>•</span>
          <span>
            Active:{' '}
            <strong className="text-foreground">
              {assignedSkills.filter((s) => s.enabled).length}
            </strong>
          </span>
        </div>
      </div>

      {/* Skills List */}
      {filteredAssigned.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-10 text-muted-foreground" />}
          title={assignedSkills.length === 0 ? 'No skills assigned' : 'No matching skills found'}
          description={
            assignedSkills.length === 0
              ? `${agent.name} currently relies on general reasoning. Equip this agent with domain-specific skills (e.g. YouTube script writing, LinkedIn hooks, Instagram carousels, sandboxed scripts) to dramatically enhance its specialized performance.`
              : 'Try adjusting your search filter.'
          }
          action={
            assignedSkills.length === 0 ? (
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="size-4" />
                Assign First Skill
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredAssigned.map((binding, idx) => {
            const skill = skillsMap.get(binding.skillId);
            const isFirst = idx === 0;
            const isLast = idx === filteredAssigned.length - 1;

            return (
              <Card
                key={binding.skillId}
                className={cn(
                  'p-4 transition-all border flex flex-col md:flex-row md:items-center justify-between gap-4',
                  binding.enabled
                    ? 'bg-card border-border shadow-xs'
                    : 'bg-muted/30 border-dashed border-border/70 opacity-75',
                )}
              >
                {/* Left: Priority badge + Details */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20">
                      #{binding.priority}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {skill?.name || binding.skillId}
                      </h4>
                      {skill?.category && (
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                          {skill.category}
                        </Badge>
                      )}
                      {skill?.executionType && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                          {skill.executionType === 'script' ? (
                            <Code2 className="size-2.5" />
                          ) : skill.executionType === 'tool_calling' ? (
                            <Zap className="size-2.5" />
                          ) : (
                            <Cpu className="size-2.5" />
                          )}
                          {skill.executionType}
                        </Badge>
                      )}
                      <span className="text-[11px] font-mono text-muted-foreground">
                        v{skill?.version || '1.0.0'}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {skill?.description || 'No description provided.'}
                    </p>

                    {skill?.requiredCapabilities && skill.requiredCapabilities.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground">Requires:</span>
                        {skill.requiredCapabilities.map((cap) => (
                          <span
                            key={cap}
                            className="inline-flex items-center rounded bg-accent/60 px-1 py-0.5 text-[9px] font-mono text-accent-foreground"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {/* Reorder Buttons */}
                  <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md hover:bg-background"
                      disabled={isFirst || saving}
                      onClick={() => handleMoveUp(idx)}
                      title="Increase priority (Move up)"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md hover:bg-background"
                      disabled={isLast || saving}
                      onClick={() => handleMoveDown(idx)}
                      title="Decrease priority (Move down)"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                  </div>

                  {/* Toggle Active Switch */}
                  <div className="flex items-center gap-2 px-2 py-1 bg-secondary/30 rounded-lg border border-border/50">
                    <span className="text-[11px] text-muted-foreground">
                      {binding.enabled ? 'Active' : 'Off'}
                    </span>
                    <Switch
                      checked={binding.enabled}
                      onCheckedChange={() => handleToggle(binding.skillId, binding.enabled)}
                      disabled={saving}
                    />
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemove(binding.skillId)}
                    title="Detach skill"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Skill Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Assign Skill to {agent.name}
            </DialogTitle>
            <DialogDescription>
              Select from available workspace skills and pre-seeded capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search available skills by name, tag, or category…"
              value={addFilterQuery}
              onChange={(e) => setAddFilterQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="flex-1 max-h-[50vh] pr-2">
            {unassignedAvailableSkills.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {allSkills.length === 0
                  ? 'No skills installed in this workspace yet. Visit the AI Skills Center to install or build skills.'
                  : 'All available skills have already been assigned to this agent.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {unassignedAvailableSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-3.5 rounded-lg border border-border bg-card/70 hover:bg-card hover:border-primary/40 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {skill.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                          {skill.category}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {skill.executionType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {skill.description}
                      </p>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        id: {skill.id}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAddSkill(skill.id)}
                      className="shrink-0 gap-1.5"
                    >
                      <Plus className="size-3.5" />
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AgentTabPage>
  );
}
