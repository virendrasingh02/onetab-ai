import { useState } from 'react';
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, AIModelBadge, AIModelIcon, toast } from '@org/ui';
import { cn } from '@org/utils';
import { agentsApi } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  GitBranch,
  Network,
  Play,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { useStudioSession } from '../../session-guard.js';

/**
 * @param {{ agent: any; onSave: (patch: Record<string, any>) => void | Promise<void> }} props
 */
export function MultiAgentTab({ agent, onSave }) {
  const { activeWorkspace } = useStudioSession();

  const [topology, setTopology] = useState(agent?.multiAgentConfig?.topology || 'supervisor');
  const [supervisorConfig, setSupervisorConfig] = useState(() => ({
    enabled: true,
    routingStrategy: 'dynamic_intent',
    consensusStrategy: 'majority_vote',
    maxDelegationDepth: 3,
    sharedMemory: true,
    allowWorkerToWorker: false,
    timeoutSeconds: 45,
    ...(agent?.multiAgentConfig?.supervisorConfig || {}),
  }));

  const [workers, setWorkers] = useState(() => {
    if (agent?.multiAgentConfig?.workers && Array.isArray(agent?.multiAgentConfig?.workers)) {
      return agent.multiAgentConfig.workers;
    }
    return [
      {
        id: 'worker-1',
        name: 'Web Intelligence Specialist',
        role: 'Research & Scraping',
        model: 'claude-3-5-sonnet',
        capabilities: ['firecrawl_search', 'firecrawl_scrape'],
        status: 'active',
      },
      {
        id: 'worker-2',
        name: 'Enterprise RAG Specialist',
        role: 'Knowledge Retrieval',
        model: 'gpt-4o',
        capabilities: ['kb_search', 'document_parser'],
        status: 'active',
      },
      {
        id: 'worker-3',
        name: 'Code Review & Security Auditor',
        role: 'PR & Vulnerability Scan',
        model: 'gemini-2-5-pro',
        capabilities: ['github_api', 'static_analysis'],
        status: 'standby',
      },
    ];
  });

  // Query workspace agents for one-click specialist import
  const { data: workspaceAgents = [] } = useQuery({
    queryKey: ['workspace-agents-swarm', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace?.id) return [];
      try {
        const list = await agentsApi.list(activeWorkspace.id);
        return list.filter((a) => a.id !== agent.id);
      } catch {
        return [];
      }
    },
    enabled: Boolean(activeWorkspace?.id),
  });

  // Add specialist modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addMode, setAddMode] = useState('new'); // 'new' | 'existing'
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('');
  const [newWorkerModel, setNewWorkerModel] = useState('gpt-4o');
  const [newWorkerCapabilities, setNewWorkerCapabilities] = useState('web_search, api_call');

  // Simulation execution state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState([
    '[00:00:01] Supervisor received user objective: "Research competitor pricing updates and notify sales"',
    '[00:00:02] Supervisor delegated sub-task to Web Intelligence Specialist (Task: Crawl pricing URLs)',
    '[00:00:04] Web Intelligence Specialist returned: 3 parsed pricing tiers ($49, $199, $499)',
    '[00:00:05] Supervisor aggregated data & passed synthesis to Enterprise RAG Specialist',
    '[00:00:06] Multi-Agent goal satisfied in 5.4s without escalation',
  ]);

  const handleAddWorker = (e) => {
    e.preventDefault();
    if (addMode === 'existing') {
      const found = workspaceAgents.find((a) => a.id === selectedAgentId);
      if (!found) {
        toast.error('Please select an existing agent');
        return;
      }
      const worker = {
        id: found.id,
        name: found.name,
        role: found.role || 'Workspace Agent',
        model: found.model || 'gpt-4o',
        capabilities: found.tools && found.tools.length > 0 ? found.tools : ['workspace_delegate'],
        status: 'active',
      };
      setWorkers([...workers, worker]);
    } else {
      if (!newWorkerName.trim()) {
        toast.error('Specialist name is required');
        return;
      }
      const worker = {
        id: `worker-${Date.now().toString(36)}`,
        name: newWorkerName.trim(),
        role: newWorkerRole.trim() || 'Sub-agent Specialist',
        model: newWorkerModel,
        capabilities: newWorkerCapabilities.split(',').map((s) => s.trim()).filter(Boolean),
        status: 'active',
      };
      setWorkers([...workers, worker]);
    }
    setIsAddOpen(false);
    setNewWorkerName('');
    setNewWorkerRole('');
    setSelectedAgentId('');
    toast.success('Specialist added to multi-agent swarm');
  };

  const handleSaveAll = () => {
    const multiAgentConfig = {
      topology,
      supervisorConfig,
      workers,
    };
    if (onSave) {
      onSave({ multiAgentConfig });
    }
    toast.success('Multi-Agent Swarm Orchestration saved');
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    setSimulationLogs(['[00:00:00] Initializing multi-agent orchestration session...']);

    await new Promise((r) => setTimeout(r, 600));
    setSimulationLogs((prev) => [
      ...prev,
      `[00:00:01] Supervisor (${agent.name}) received task: "Deconstruct multi-step enterprise intake"`,
    ]);

    await new Promise((r) => setTimeout(r, 800));
    const firstWorker = workers[0]?.name || 'Specialist Worker';
    setSimulationLogs((prev) => [
      ...prev,
      `[00:00:02] Routing sub-task 1/2 to [${firstWorker}] via ${supervisorConfig.routingStrategy}`,
    ]);

    await new Promise((r) => setTimeout(r, 1000));
    setSimulationLogs((prev) => [
      ...prev,
      `[00:00:04] [${firstWorker}] finished sub-task (extracted payload verified against schema)`,
    ]);

    if (workers[1]) {
      await new Promise((r) => setTimeout(r, 800));
      setSimulationLogs((prev) => [
        ...prev,
        `[00:00:05] Routing sub-task 2/2 to [${workers[1].name}] with shared blackboard context`,
      ]);
      await new Promise((r) => setTimeout(r, 900));
      setSimulationLogs((prev) => [
        ...prev,
        `[00:00:07] [${workers[1].name}] delivered verified output`,
      ]);
    }

    await new Promise((r) => setTimeout(r, 700));
    setSimulationLogs((prev) => [
      ...prev,
      `[00:00:08] Multi-Agent consensus achieved (${supervisorConfig.consensusStrategy}). Turn finalized.`,
    ]);
    setIsSimulating(false);
    toast.success('Swarm simulation complete');
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Network className="size-4" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Multi-Agent Swarm Orchestration</h2>
            <Badge variant="outline" className="text-xs text-primary border-primary/30 uppercase">
              {topology}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Coordinate specialized autonomous sub-agents under a central Supervisor reasoner. Configure delegation topologies, shared execution state, and circular handoff prevention.
          </p>
        </div>

        <Button size="sm" onClick={handleSaveAll} className="gap-1.5 text-xs font-semibold self-start sm:self-auto">
          <Save className="size-3.5" />
          Save Swarm Config
        </Button>
      </div>

      {/* Topology Selector */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-3">
        <label className="text-xs font-semibold text-foreground">Orchestration Topology</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              id: 'supervisor',
              title: 'Supervisor Pattern',
              desc: 'Central manager routes tasks to specialized workers.',
            },
            {
              id: 'swarm',
              title: 'Swarm / Mesh (P2P)',
              desc: 'Decentralized peer-to-peer autonomous handoffs.',
            },
            {
              id: 'hierarchical',
              title: 'Hierarchical Tree',
              desc: 'Multi-level supervisor tree for complex enterprise pipelines.',
            },
            {
              id: 'router',
              title: 'Router / Dispatcher',
              desc: 'Direct classification & fan-out to single best specialist.',
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTopology(item.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                topology === item.id
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-surface-raised hover:border-primary/50',
              )}
            >
              <div className="text-xs font-bold text-foreground">{item.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Supervisor Configuration Card */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Supervisor Manager Agent</h3>
            <p className="text-xs text-muted-foreground">Primary orchestrator: {agent.name}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success border border-success/20">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            Supervisor Active
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-foreground">Delegation Routing Strategy</label>
            <select
              value={supervisorConfig.routingStrategy}
              onChange={(e) => setSupervisorConfig({ ...supervisorConfig, routingStrategy: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="dynamic_intent">Dynamic Intent Classification</option>
              <option value="sequential">Sequential Assembly Line</option>
              <option value="parallel_voting">Parallel Multi-Agent Consensus</option>
              <option value="hierarchical">Hierarchical Delegation</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-foreground">Consensus & Synthesis Strategy</label>
            <select
              value={supervisorConfig.consensusStrategy}
              onChange={(e) => setSupervisorConfig({ ...supervisorConfig, consensusStrategy: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="majority_vote">Majority Voting (N/2 + 1)</option>
              <option value="supervisor_synthesis">Supervisor LLM Synthesis</option>
              <option value="highest_confidence">Highest Confidence Selection</option>
              <option value="unanimous">Unanimous Verification</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-foreground">Max Delegation Depth</label>
            <Input
              type="number"
              min={1}
              max={6}
              value={supervisorConfig.maxDelegationDepth}
              onChange={(e) => setSupervisorConfig({ ...supervisorConfig, maxDelegationDepth: parseInt(e.target.value) || 3 })}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/60 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={supervisorConfig.sharedMemory}
              onChange={(e) => setSupervisorConfig({ ...supervisorConfig, sharedMemory: e.target.checked })}
              className="size-3.5 rounded accent-primary"
            />
            <span className="text-foreground">Shared Blackboard Memory</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={supervisorConfig.allowWorkerToWorker}
              onChange={(e) => setSupervisorConfig({ ...supervisorConfig, allowWorkerToWorker: e.target.checked })}
              className="size-3.5 rounded accent-primary"
            />
            <span className="text-foreground">Allow Worker-to-Worker Handoff</span>
          </label>
        </div>
      </div>

      {/* Specialist Workers Pool */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Specialist Sub-Agents Pool ({workers.length})</h3>
            <p className="text-xs text-muted-foreground">Agents available for dynamic task delegation</p>
          </div>
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1 text-xs font-semibold">
            <Plus className="size-3.5" />
            Add Specialist
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="size-3.5" />
                  </div>
                  <AIModelBadge modelId={worker.model} variant="subtle" size="xs" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">{worker.name}</div>
                  <div className="text-[11px] text-muted-foreground">{worker.role}</div>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(worker.capabilities || []).map((cap) => (
                    <span
                      key={cap}
                      className="rounded bg-surface-raised px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground border border-border"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-[10px] text-success font-medium">● Ready</span>
                <button
                  onClick={() => {
                    setWorkers(workers.filter((w) => w.id !== worker.id));
                    toast.info(`Removed ${worker.name}`);
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulated Delegation Communication Log */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <GitBranch className="size-3.5 text-primary" />
            Agent Handoff Event Log (Live Trace)
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={runSimulation}
            loading={isSimulating}
            className="gap-1 text-xs"
          >
            <Play className="size-3 text-success" />
            Simulate Swarm Turn
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300 space-y-2 max-h-56 overflow-y-auto">
          {simulationLogs.map((log, i) => (
            <div
              key={i}
              className={cn(
                log.includes('Supervisor')
                  ? 'text-accent-indigo'
                  : log.includes('returned') || log.includes('satisfied') || log.includes('delivered')
                  ? 'text-success'
                  : 'text-muted-foreground',
              )}
            >
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* Add Specialist Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <span>Add Specialist Sub-Agent</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddWorker}>
            <DialogBody className="space-y-4 text-xs">
              <div className="flex rounded-lg border border-border bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setAddMode('new')}
                  className={cn(
                    'flex-1 rounded py-1 text-xs font-medium transition-colors',
                    addMode === 'new' ? 'bg-primary/15 text-primary font-bold' : 'text-muted-foreground',
                  )}
                >
                  Create Custom Specialist
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('existing')}
                  className={cn(
                    'flex-1 rounded py-1 text-xs font-medium transition-colors',
                    addMode === 'existing' ? 'bg-primary/15 text-primary font-bold' : 'text-muted-foreground',
                  )}
                >
                  Select Existing Agent ({workspaceAgents.length})
                </button>
              </div>

              {addMode === 'existing' ? (
                <div>
                  <label className="text-[11px] font-semibold text-foreground">Select Agent</label>
                  {workspaceAgents.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No other agents in this workspace.</p>
                  ) : (
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Choose an agent...</option>
                      {workspaceAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.role || 'Agent'}) • {a.model}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-foreground">Specialist Name</label>
                    <Input
                      placeholder="e.g. Financial Data Analyst"
                      value={newWorkerName}
                      onChange={(e) => setNewWorkerName(e.target.value)}
                      className="mt-1 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-foreground">Role / Domain</label>
                    <Input
                      placeholder="e.g. SEC Filings & Earnings Extraction"
                      value={newWorkerRole}
                      onChange={(e) => setNewWorkerRole(e.target.value)}
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-foreground">Foundation Model</label>
                        <AIModelBadge modelId={newWorkerModel} variant="subtle" size="xs" />
                      </div>
                      <select
                        value={newWorkerModel}
                        onChange={(e) => setNewWorkerModel(e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                      >
                        <option value="gpt-4o">OpenAI GPT-4o</option>
                        <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                        <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                        <option value="gemini-2-5-pro">Gemini 2.5 Pro</option>
                        <option value="deepseek-chat">DeepSeek V3</option>
                        <option value="deepseek-reasoner">DeepSeek R1</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-foreground">Capabilities (comma separated)</label>
                      <Input
                        placeholder="web_search, extract"
                        value={newWorkerCapabilities}
                        onChange={(e) => setNewWorkerCapabilities(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}
            </DialogBody>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Add to Swarm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
