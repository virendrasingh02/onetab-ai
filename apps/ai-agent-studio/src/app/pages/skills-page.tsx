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
  Input,
  LoadingState,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  GitBranch,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { StudioPage } from '../components/studio-page.js';
import { useNavigate } from '../router.js';
import { useStudioSession } from '../session-guard.js';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: { name: string; url?: string };
  category: string;
  tags: string[];
  executionType: string;
  instructions: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  parameters?: Record<string, any>;
  requiredCapabilities?: string[];
  permissions?: Array<{ scope: string; label: string; description: string; sensitive: boolean }>;
  templates?: Record<string, string>;
  installation?: {
    id: string;
    status: string;
    version: string;
    config: Record<string, any>;
    approvedPermissions: string[];
  };
}

export function SkillsPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();

  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed' | 'import'>('marketplace');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Skill Details Dialog
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);

  // Playground drawer
  const [playgroundSkill, setPlaygroundSkill] = useState<SkillItem | null>(null);
  const [playgroundInput, setPlaygroundInput] = useState<Record<string, any>>({});
  const [playgroundRunning, setPlaygroundRunning] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);

  // Importer state
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);

  // Fetch skills from API
  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/workspaces/${activeWorkspace.id}/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data.items || []);
      }
    } catch {
      toast.error('Failed to load skills.');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace.id]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Seed social agents
  const seedSocialAgents = async () => {
    try {
      toast.info('Seeding YouTube, LinkedIn, and Instagram Agents...');
      const res = await fetch(`/api/v1/workspaces/${activeWorkspace.id}/skills/seed-social-agents`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Successfully created YouTube, LinkedIn, and Instagram Agents!');
        navigate('/agents');
      } else {
        toast.error('Could not create agents.');
      }
    } catch {
      toast.error('Failed to seed social agents.');
    }
  };

  // Toggle skill active state
  const toggleSkill = async (skill: SkillItem, enabled: boolean) => {
    try {
      const res = await fetch(
        `/api/v1/workspaces/${activeWorkspace.id}/skills/${skill.id}/toggle`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        },
      );
      if (res.ok) {
        toast.success(`Skill '${skill.name}' is now ${enabled ? 'active' : 'disabled'}.`);
        fetchSkills();
      }
    } catch {
      toast.error('Failed to toggle skill.');
    }
  };

  // Install skill
  const installSkill = async (skill: SkillItem) => {
    try {
      const res = await fetch(
        `/api/v1/workspaces/${activeWorkspace.id}/skills/${skill.id}/install`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      if (res.ok) {
        toast.success(`Skill '${skill.name}' installed successfully!`);
        fetchSkills();
      }
    } catch {
      toast.error('Failed to install skill.');
    }
  };

  // Uninstall skill
  const uninstallSkill = async (skill: SkillItem) => {
    try {
      const res = await fetch(
        `/api/v1/workspaces/${activeWorkspace.id}/skills/${skill.id}/install`,
        {
          method: 'DELETE',
        },
      );
      if (res.ok) {
        toast.success(`Skill '${skill.name}' uninstalled.`);
        fetchSkills();
      }
    } catch {
      toast.error('Failed to uninstall skill.');
    }
  };

  // Run Playground Execution
  const runPlayground = async () => {
    if (!playgroundSkill) return;
    try {
      setPlaygroundRunning(true);
      setPlaygroundResult(null);
      const res = await fetch(
        `/api/v1/workspaces/${activeWorkspace.id}/skills/${playgroundSkill.id}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: playgroundInput,
            dryRun: true,
          }),
        },
      );
      const data = await res.json();
      setPlaygroundResult(data);
      if (data.ok) {
        toast.success(`Execution completed in ${data.latencyMs || 0}ms`);
      } else {
        toast.error(data.error?.message || 'Skill execution failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Execution error.');
    } finally {
      setPlaygroundRunning(false);
    }
  };

  // Preview Import from GitHub
  const handlePreviewImport = async () => {
    if (!importUrl) return;
    try {
      setImportLoading(true);
      const res = await fetch(
        `/api/v1/workspaces/${activeWorkspace.id}/skills/import/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: importUrl.includes('github.com') ? 'github' : 'skill_md',
            url: importUrl,
          }),
        },
      );
      const data = await res.json();
      setImportPreview(data);
    } catch {
      toast.error('Failed to preview import.');
    } finally {
      setImportLoading(false);
    }
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    try {
      setImportLoading(true);
      const res = await fetch(`/api/v1/workspaces/${activeWorkspace.id}/skills/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: importUrl.includes('github.com') ? 'github' : 'skill_md',
          url: importUrl,
          autoInstall: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully imported ${data.importedCount} skills!`);
        setImportUrl('');
        setImportPreview(null);
        fetchSkills();
        setActiveTab('installed');
      } else {
        toast.error(data.message || 'Import failed.');
      }
    } catch {
      toast.error('Failed to complete import.');
    } finally {
      setImportLoading(false);
    }
  };

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      if (activeTab === 'installed' && (!s.installation || s.installation.status === 'UNINSTALLED')) {
        return false;
      }
      if (selectedCategory !== 'all' && s.category !== selectedCategory) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [skills, activeTab, selectedCategory, search]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => set.add(s.category));
    return ['all', ...Array.from(set)];
  }, [skills]);

  return (
    <StudioPage
      title="Universal AI Skills Engine"
      description="Extensible ecosystem of reusable, composable AI capabilities, hook scoring engines, scripts, and connectors."
      icon={<Sparkles className="size-5 text-primary" />}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={seedSocialAgents}
            className="flex items-center gap-1.5"
          >
            <Bot className="size-4 text-primary" />
            Seed Social Media Agents
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/skills/builder')}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Build Custom Skill
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full sm:w-auto"
          >
            <TabsList>
              <TabsTrigger value="marketplace" className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Skills Marketplace
                <Badge variant="secondary" className="ml-1 text-xs">
                  {skills.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="installed" className="flex items-center gap-2">
                <Cpu className="size-4" />
                Installed Skills
                <Badge variant="secondary" className="ml-1 text-xs">
                  {skills.filter((s) => s.installation && s.installation.status === 'ACTIVE').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Download className="size-4" />
                Import from GitHub / SKILL.md
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search skills, hooks, tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        {activeTab !== 'import' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-muted-foreground font-medium mr-1">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1 rounded-full font-medium transition-colors border',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-accent',
                )}
              >
                {cat.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <LoadingState />
        ) : activeTab === 'import' ? (
          /* Import Skills Section */
          <Card className="p-6 max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <GitBranch className="size-5" />
                Import Dynamic Skill Package
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Install any compatible Claude skill, SKILL.md, or GitHub repository directly into your Mie workspace.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  GitHub Repository URL or Raw SKILL.md Link
                </label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder="https://github.com/Jakeschincariol/youtube-agent-skill"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                  <Button
                    onClick={handlePreviewImport}
                    disabled={!importUrl || importLoading}
                    variant="outline"
                  >
                    {importLoading ? 'Scanning...' : 'Scan & Preview'}
                  </Button>
                </div>
              </div>

              {/* Quick links to sample repos */}
              <div className="text-xs text-muted-foreground space-y-1">
                <span>Quick demo repositories:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setImportUrl('https://github.com/Jakeschincariol/youtube-agent-skill')}
                    className="text-primary hover:underline"
                  >
                    YouTube Agent Skill
                  </button>
                  •
                  <button
                    type="button"
                    onClick={() => setImportUrl('https://github.com/Jakeschincariol/linkedin-agent-skill')}
                    className="text-primary hover:underline"
                  >
                    LinkedIn Agent Skill
                  </button>
                  •
                  <button
                    type="button"
                    onClick={() => setImportUrl('https://github.com/Jakeschincariol/instagram-agent-skill')}
                    className="text-primary hover:underline"
                  >
                    Instagram Agent Skill
                  </button>
                </div>
              </div>

              {/* Import Preview Box */}
              {importPreview && (
                <div className="border border-border rounded-lg p-4 space-y-4 bg-accent/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{importPreview.manifest?.name || 'Scanned Package'}</h4>
                      <p className="text-xs text-muted-foreground">{importPreview.manifest?.description}</p>
                    </div>
                    <Badge variant={importPreview.valid ? 'success' : 'destructive'}>
                      {importPreview.valid ? 'Verified Clean' : 'Issues Found'}
                    </Badge>
                  </div>

                  {importPreview.warnings?.length > 0 && (
                    <div className="text-xs space-y-1 text-amber-500 bg-amber-500/10 p-2.5 rounded">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5" /> Security Notices:
                      </div>
                      {importPreview.warnings.map((w: string, i: number) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Execution Type: <strong className="text-foreground">{importPreview.detectedType}</strong>
                    </span>
                    <Button
                      size="sm"
                      onClick={handleConfirmImport}
                      disabled={importLoading || !importPreview.valid}
                      className="flex items-center gap-1.5"
                    >
                      <Download className="size-4" />
                      Confirm & Install Package
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : filteredSkills.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Cpu className="size-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No skills match your filters.</p>
            <p className="text-xs mt-1">Try another category or import a new skill package.</p>
          </Card>
        ) : (
          /* Skills Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => {
              const isInstalled = skill.installation && skill.installation.status !== 'UNINSTALLED';
              const isActive = skill.installation?.status === 'ACTIVE';

              return (
                <Card
                  key={skill.id}
                  className={cn(
                    'flex flex-col justify-between p-5 border transition-all duration-200 hover:shadow-md',
                    isActive ? 'border-primary/40 bg-card' : 'border-border bg-card/60',
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                          {skill.id.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm leading-tight text-foreground">
                            {skill.name}
                          </h3>
                          <span className="text-xs text-muted-foreground font-mono">
                            {skill.id} v{skill.version}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {skill.executionType}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {skill.description}
                    </p>

                    {skill.tags && skill.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skill.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSkill(skill)}
                        className="text-xs flex items-center gap-1 h-8 px-2"
                      >
                        <Eye className="size-3.5" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPlaygroundSkill(skill);
                          setPlaygroundInput({});
                          setPlaygroundResult(null);
                        }}
                        className="text-xs flex items-center gap-1 h-8 px-2"
                      >
                        <Play className="size-3 text-emerald-500" />
                        Playground
                      </Button>
                    </div>

                    {isInstalled ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked) => toggleSkill(skill, checked)}
                        />
                        <span className="text-[11px] font-medium">
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => installSkill(skill)}
                        className="text-xs h-8 px-3"
                      >
                        Install
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Skill Details Dialog */}
      <Dialog open={!!selectedSkill} onOpenChange={(open) => !open && setSelectedSkill(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedSkill?.category}</Badge>
              <Badge>{selectedSkill?.executionType}</Badge>
            </div>
            <DialogTitle className="text-xl mt-1">{selectedSkill?.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              ID: {selectedSkill?.id} • Version: {selectedSkill?.version} • Author: {selectedSkill?.author?.name}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 space-y-4">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Description
                </h4>
                <p className="text-foreground leading-relaxed">{selectedSkill?.description}</p>
              </div>

              {selectedSkill?.instructions && (
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    System Instructions & Guidelines
                  </h4>
                  <pre className="p-3 rounded-lg bg-accent/40 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedSkill.instructions}
                  </pre>
                </div>
              )}

              {selectedSkill?.inputs && Object.keys(selectedSkill.inputs).length > 0 && (
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Input Parameters
                  </h4>
                  <div className="border border-border rounded-lg divide-y divide-border text-xs">
                    {Object.entries(selectedSkill.inputs).map(([k, v]) => (
                      <div key={k} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-foreground">{k}</span>
                          <span className="text-muted-foreground ml-2">({v.type})</span>
                          {v.required && <Badge variant="secondary" className="ml-2 text-[10px]">Required</Badge>}
                          <div className="text-muted-foreground mt-0.5">{v.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSkill?.permissions && selectedSkill.permissions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Required Permissions
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSkill.permissions.map((p, i) => (
                      <Badge key={i} variant={p.sensitive ? 'destructive' : 'outline'} className="text-xs">
                        <Shield className="size-3 mr-1" />
                        {p.label || p.scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border pt-3">
            {selectedSkill?.installation ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (selectedSkill) uninstallSkill(selectedSkill);
                  setSelectedSkill(null);
                }}
              >
                <Trash2 className="size-4 mr-1" />
                Uninstall
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const s = selectedSkill;
                  setSelectedSkill(null);
                  if (s) {
                    setPlaygroundSkill(s);
                    setPlaygroundInput({});
                    setPlaygroundResult(null);
                  }
                }}
              >
                Open in Playground
              </Button>
              <Button size="sm" onClick={() => setSelectedSkill(null)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive Testing Playground Drawer */}
      <Sheet open={!!playgroundSkill} onOpenChange={(open) => !open && setPlaygroundSkill(null)}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-6">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{playgroundSkill?.executionType}</Badge>
            </div>
            <SheetTitle className="text-lg">Skill Playground: {playgroundSkill?.name}</SheetTitle>
            <SheetDescription className="text-xs">
              Test execution with custom inputs inside the isolated Mie Skills runtime.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-1">
            {/* Dynamic Inputs Form */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Input Parameters
              </h4>
              {playgroundSkill?.inputs && Object.keys(playgroundSkill.inputs).length > 0 ? (
                Object.entries(playgroundSkill.inputs).map(([key, field]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium flex items-center justify-between">
                      <span>{field.name || key}</span>
                      {field.required && <span className="text-destructive text-[10px]">*required</span>}
                    </label>
                    <Input
                      placeholder={field.description || `Enter ${key}...`}
                      value={playgroundInput[key] ?? ''}
                      onChange={(e) =>
                        setPlaygroundInput((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="text-xs h-9"
                    />
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">This skill requires no structured inputs.</div>
              )}
            </div>

            <Button
              onClick={runPlayground}
              disabled={playgroundRunning}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {playgroundRunning ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Running inside Sandbox...
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Execute Skill
                </>
              )}
            </Button>

            {/* Execution Output */}
            {playgroundResult && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    {playgroundResult.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-destructive" />
                    )}
                    Execution {playgroundResult.ok ? 'Successful' : 'Failed'}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {playgroundResult.latencyMs || 0}ms • {playgroundResult.tokensUsed || 0} tokens
                  </span>
                </div>

                <div className="rounded-lg bg-accent/30 p-3 font-mono text-xs overflow-x-auto max-h-64 border border-border">
                  <pre className="whitespace-pre-wrap text-foreground">
                    {JSON.stringify(playgroundResult.data || playgroundResult.error, null, 2)}
                  </pre>
                </div>

                {playgroundResult.logs && playgroundResult.logs.length > 0 && (
                  <div className="text-[11px] font-mono text-muted-foreground space-y-0.5 pt-1">
                    <div className="font-semibold text-xs text-foreground mb-1">Execution Logs:</div>
                    {playgroundResult.logs.map((log: string, idx: number) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </StudioPage>
  );
}
