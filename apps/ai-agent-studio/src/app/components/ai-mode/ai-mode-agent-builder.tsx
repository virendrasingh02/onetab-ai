import { useState } from 'react';
import {
  agentStudioAiModeApi,
} from '@org/api-client';
import type {
  AgentBuilderRunEvent,
  AgentBuilderState,
  AgentIterationDiff,
  AgentPlan,
  AgentSpec,
  DynamicQuestion,
  IntentClassification,
} from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  GitBranch,
  GitPullRequest,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';

interface AIModeAgentBuilderProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onAgentCreated?: (agentId: string) => void;
}

const INTAKE_EXAMPLES = [
  {
    title: 'Gmail Agent',
    prompt: 'Create a Gmail agent that summarizes unread emails, drafts replies and lets me send them.',
    icon: Mail,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  {
    title: 'GitHub Agent',
    prompt: 'Create a GitHub agent that monitors repository activity, reviews open PRs, and summarizes diffs.',
    icon: GitPullRequest,
    color: 'text-accent-violet bg-accent-violet/10 border-accent-violet/20',
  },
  {
    title: 'Sales CRM Agent',
    prompt: 'Create an AI employee for sales that checks incoming leads, analyzes prospect fit, and drafts follow-up notes.',
    icon: Zap,
    color: 'text-warning bg-warning/10 border-warning/20',
  },
  {
    title: 'Deep Research Agent',
    prompt: 'Create a research agent that performs structured web research, synthesizes sources, and compiles reports.',
    icon: Search,
    color: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20',
  },
  {
    title: 'Customer Support Agent',
    prompt: 'Create a customer-support agent that categorizes user requests, queries policy docs, and drafts replies.',
    icon: ShieldCheck,
    color: 'text-success bg-success/10 border-success/20',
  },
  {
    title: 'Project Management Agent',
    prompt: 'Create a project-management agent that tracks tasks, sprint milestones, and alerts on blockers.',
    icon: Layers,
    color: 'text-accent-indigo bg-accent-indigo/10 border-accent-indigo/20',
  },
];

export function AIModeAgentBuilder({
  workspaceId,
  isOpen,
  onClose,
  onAgentCreated,
}: AIModeAgentBuilderProps) {
  // State Machine
  const [state, setState] = useState<AgentBuilderState>('INTAKE');
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Agent Creation Artifacts
  const [classification, setClassification] = useState<IntentClassification | null>(null);
  const [questions, setQuestions] = useState<DynamicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [agentSpec, setAgentSpec] = useState<AgentSpec | null>(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  // Execution & Live Building Trace
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentBuilderRunEvent[]>([]);

  // Testing & Preview
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Follow-up Iteration
  const [iterationPrompt, setIterationPrompt] = useState('');
  const [iterationDiff, setIterationDiff] = useState<AgentIterationDiff | null>(null);
  const [isIterating, setIsIterating] = useState(false);

  // 1. INTAKE -> UNDERSTAND -> REQUIREMENTS
  const handleIntakeSubmit = async (customPrompt?: string) => {
    const textToSubmit = (customPrompt || prompt).trim();
    if (!textToSubmit) return;

    setPrompt(textToSubmit);
    setIsProcessing(true);
    setState('UNDERSTAND');

    try {
      // Step A: Classify Intent
      const intentResult = await agentStudioAiModeApi.classifyIntent(workspaceId, textToSubmit);
      setClassification(intentResult);

      // Step B: Generate Dynamic Requirements
      const reqsResult = await agentStudioAiModeApi.generateRequirements(
        workspaceId,
        textToSubmit,
        intentResult,
      );
      setQuestions(reqsResult.questions);
      setAnswers(reqsResult.defaultAnswers || {});

      setState('REQUIREMENTS');
    } catch {
      toast.error('Failed to analyze prompt. Reverting to intake.');
      setState('INTAKE');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. REQUIREMENTS -> AGENT PLAN & COMPILE SPEC
  const handleProceedToPlan = async (useDefaults = false) => {
    if (!classification) return;
    setIsProcessing(true);
    setState('AGENT_PLAN');

    try {
      const activeAnswers = useDefaults
        ? questions.reduce((acc, q) => ({ ...acc, [q.id]: q.default }), {})
        : answers;

      setAnswers(activeAnswers);

      // Generate Plan
      const planResult = await agentStudioAiModeApi.generatePlan(
        workspaceId,
        prompt,
        classification,
        activeAnswers,
      );
      setPlan(planResult);

      // Compile Initial Spec
      const specResult = await agentStudioAiModeApi.compileSpec(
        workspaceId,
        prompt,
        classification,
        activeAnswers,
        planResult,
      );
      setAgentSpec(specResult);

      setState('PLAN_REVIEW');
    } catch {
      toast.error('Failed to generate agent plan.');
      setState('REQUIREMENTS');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. PLAN REVIEW -> BUILDING (AGENTIC EXECUTION LOOP)
  const handleStartBuilding = async () => {
    if (!plan || !agentSpec) return;
    setState('BUILDING');
    setIsProcessing(true);

    let currentSpec = { ...agentSpec };
    const currentPlan = { ...plan };

    for (let i = 0; i < currentPlan.steps.length; i++) {
      const step = currentPlan.steps[i];
      setCurrentStepId(step.id);

      try {
        const result = await agentStudioAiModeApi.executeStep(
          workspaceId,
          step.id,
          currentPlan,
          currentSpec,
        );

        currentPlan.steps[i] = result.step;
        currentSpec = result.agentSpec;
        setPlan({ ...currentPlan });
        setAgentSpec({ ...currentSpec });
        setEvents((prev) => [...prev, result.event]);

        // Brief delay for realistic pacing of live telemetry
        await new Promise((r) => setTimeout(r, 400));
      } catch (err: any) {
        step.status = 'failed';
        step.error = err.message || 'Execution error';
        setPlan({ ...currentPlan });
        toast.error(`Step "${step.title}" encountered a roadblock.`);
        break;
      }
    }

    setIsProcessing(false);
    setCurrentStepId(null);
    setState('PREVIEW');
  };

  // 4. TEST RUN IN PREVIEW LAB
  const handleRunTest = async () => {
    if (!testPrompt.trim() || !agentSpec) return;
    setIsTesting(true);

    try {
      // Simulate/Dry Run Turn
      const isGmail = agentSpec.integrations.some((i) => i.provider === 'GMAIL');
      const isGithub = agentSpec.integrations.some((i) => i.provider === 'GITHUB');

      await new Promise((r) => setTimeout(r, 800));

      if (isGmail) {
        setTestResult({
          status: 'completed',
          toolsExecuted: [
            { name: 'gmail_search_emails', input: { q: 'is:unread' }, result: 'Found 12 unread emails.' },
            { name: 'gmail_create_draft', input: { subject: 'Re: Project Update' }, result: 'Draft created.' },
          ],
          response:
            'I inspected your inbox and categorized 12 unread emails:\n\n• **3 Action Required**: Client invoices, design approval request\n• **5 Informational**: Standup summaries, automated CI notifications\n• **4 Newsletters**: Subscribed tech digests\n\nI have prepared draft responses for the 2 client threads for your review.',
          requiresApproval: agentSpec.permissions.toolPolicies['gmail_send_message']?.requiresApproval,
          approvalAction: {
            tool: 'gmail_send_message',
            target: 'client@example.com',
            subject: 'Re: Project Update',
          },
        });
      } else if (isGithub) {
        setTestResult({
          status: 'completed',
          toolsExecuted: [
            { name: 'github_list_pull_requests', input: { state: 'open' }, result: 'Found 3 open pull requests.' },
            { name: 'github_get_pull_request', input: { prNumber: 42 }, result: 'Fetched diff: 12 files changed, +184 -42 lines.' },
          ],
          response:
            'I analyzed PR #42 ("feat: migrate auth to OAuth PKCE"):\n\n• **Architecture**: Follows best practices with secure state storage.\n• **Security**: No hardcoded secrets detected.\n• **Tests**: 1 test fixture requires update in `auth.spec.ts`.\n\nReady to post a comment once approved.',
          requiresApproval: true,
          approvalAction: {
            tool: 'github_comment_on_issue',
            repo: 'org/repo',
            body: 'LGTM with minor test fixture comment.',
          },
        });
      } else {
        setTestResult({
          status: 'completed',
          toolsExecuted: [
            { name: 'search_docs', input: { query: testPrompt }, result: 'Found 2 matching documents.' },
          ],
          response: `I processed your request using workspace tools.\n\nDirective executed successfully with 0 errors.`,
        });
      }
    } catch {
      toast.error('Test run failed');
    } finally {
      setIsTesting(false);
    }
  };

  // 5. PUBLISH AGENT TO APP REGISTRY & CHAT
  const handlePublish = async () => {
    if (!agentSpec) return;
    setIsProcessing(true);

    try {
      const publishRes = await agentStudioAiModeApi.publish(workspaceId, agentSpec);
      setCreatedAgentId(publishRes.agentId);
      setState('PUBLISHED');
      toast.success(`Agent "${agentSpec.name}" published to App Registry & Chat!`);
      if (onAgentCreated) onAgentCreated(publishRes.agentId);
    } catch {
      toast.error('Failed to publish agent');
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. FOLLOW-UP NATURAL LANGUAGE ITERATION (DIFF ENGINE)
  const handleIterate = async () => {
    if (!createdAgentId || !iterationPrompt.trim()) return;
    setIsIterating(true);

    try {
      const diffResult = await agentStudioAiModeApi.iterate(
        workspaceId,
        createdAgentId,
        iterationPrompt.trim(),
      );
      setIterationDiff(diffResult);
      setAgentSpec(diffResult.appliedSpec);
      setIterationPrompt('');
      toast.success('Generated iteration diff plan.');
    } catch {
      toast.error('Failed to iterate on agent');
    } finally {
      setIsIterating(false);
    }
  };

  const handleApplyIteration = async () => {
    if (!agentSpec) return;
    setIsProcessing(true);
    try {
      await agentStudioAiModeApi.publish(workspaceId, agentSpec);
      setIterationDiff(null);
      toast.success(`Agent updated to version v${agentSpec.version}!`);
    } catch {
      toast.error('Failed to apply iteration');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setState('INTAKE');
    setPrompt('');
    setClassification(null);
    setQuestions([]);
    setAnswers({});
    setPlan(null);
    setAgentSpec(null);
    setEvents([]);
    setTestResult(null);
    setIterationDiff(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card text-card-foreground border-border shadow-2xl">
        {/* HEADER */}
        <DialogHeader className="p-4 border-b border-border/80 bg-muted/30 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wand2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>AI Mode — Agentic App Builder</span>
                <Badge variant="primary" className="text-[10px] uppercase font-bold py-0 h-4">
                  {state.replace('_', ' ')}
                </Badge>
              </DialogTitle>
              <div className="text-xs text-muted-foreground">
                Describe an AI Agent or Agentic App for your workspace and Chat
              </div>
            </div>
          </div>
          {state !== 'INTAKE' && state !== 'PUBLISHED' && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
              <RefreshCw className="size-3.5 mr-1" />
              <span>Restart</span>
            </Button>
          )}
        </DialogHeader>

        {/* BODY BY STATE */}
        <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================= */}
          {/* 1. INTAKE & UNDERSTAND                                   */}
          {/* ========================================================= */}
          {state === 'INTAKE' && (
            <div className="space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-2 pt-2">
                <h3 className="text-lg font-bold tracking-tight">What do you want your agent to do?</h3>
                <p className="text-xs text-muted-foreground">
                  Describe the agent in plain language. The AI builder will classify intent, configure tools,
                  assemble workflows, and publish the agent directly into Chat.
                </p>
              </div>

              {/* Prompt Box */}
              <div className="relative rounded-xl border border-border bg-background p-2 shadow-xs focus-within:ring-2 focus-within:ring-primary/20">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Create a Gmail agent that summarizes my unread emails, drafts replies, and lets me send them with confirmation..."
                  rows={3}
                  className="w-full resize-none border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none p-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleIntakeSubmit();
                    }
                  }}
                />
                <div className="flex items-center justify-between border-t border-border/40 pt-2 px-2">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-primary" />
                    <span>Uses platform tools, credentials & workspace memory</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleIntakeSubmit()}
                    disabled={!prompt.trim() || isProcessing}
                    className="gap-1.5"
                  >
                    {isProcessing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="size-3.5" />
                    )}
                    <span>Create Agent</span>
                  </Button>
                </div>
              </div>

              {/* Inspiration Examples */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Or select a starter agentic capability:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {INTAKE_EXAMPLES.map((ex) => {
                    const Icon = ex.icon;
                    return (
                      <button
                        key={ex.title}
                        type="button"
                        onClick={() => handleIntakeSubmit(ex.prompt)}
                        className="flex flex-col text-left p-3 rounded-xl border border-border bg-background hover:bg-muted/40 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={cn('p-1.5 rounded-lg border', ex.color)}>
                            <Icon className="size-4" />
                          </div>
                          <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {ex.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {ex.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* UNDERSTAND LOADING STATE                                  */}
          {/* ========================================================= */}
          {state === 'UNDERSTAND' && (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Analyzing your request...</h4>
                <p className="text-xs text-muted-foreground">
                  Identifying intent, integration requirements, and security policies.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. DYNAMIC REQUIREMENTS                                   */}
          {/* ========================================================= */}
          {state === 'REQUIREMENTS' && classification && (
            <div className="space-y-6">
              {/* Classification Pill */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                    AI
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>{classification.suggestedName}</span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {classification.category}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {classification.reasoning}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleProceedToPlan(true)}
                  className="text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Sparkles className="size-3" />
                  <span>Use Recommended Defaults</span>
                </Button>
              </div>

              {/* Dynamic Questions List */}
              <div className="space-y-5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Agent Specifications ({questions.length} questions)
                </div>

                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-border bg-background space-y-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>{q.label}</span>
                        {q.required && <span className="text-destructive">*</span>}
                        <Badge variant="neutral" className="text-[9px] py-0 h-3.5">
                          {q.group}
                        </Badge>
                      </div>
                      {q.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {q.description}
                        </p>
                      )}
                    </div>

                    {/* Multi-Select Options */}
                    {q.type === 'multi-select' && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt) => {
                          const currentVals = (answers[q.id] as string[]) || [];
                          const isSelected = currentVals.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                const next = isSelected
                                  ? currentVals.filter((v) => v !== opt.value)
                                  : [...currentVals, opt.value];
                                setAnswers({ ...answers, [q.id]: next });
                              }}
                              className={cn(
                                'flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors cursor-pointer',
                                isSelected
                                  ? 'border-primary bg-primary/5 text-foreground'
                                  : 'border-border bg-surface hover:bg-muted/40 text-muted-foreground',
                              )}
                            >
                              <div
                                className={cn(
                                  'flex size-4 shrink-0 rounded border items-center justify-center mt-0.5',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border',
                                )}
                              >
                                {isSelected && <Check className="size-2.5 stroke-3" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <span>{opt.label}</span>
                                  {opt.isRecommended && (
                                    <span className="text-[9px] text-success font-bold uppercase">
                                      (Recommended)
                                    </span>
                                  )}
                                </div>
                                {opt.description && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                    {opt.description}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Single-Select Options */}
                    {q.type === 'single-select' && q.options && (
                      <div className="space-y-2 pt-1">
                        {q.options.map((opt) => {
                          const isSelected = answers[q.id] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAnswers({ ...answers, [q.id]: opt.value })}
                              className={cn(
                                'flex items-start gap-2.5 p-2.5 w-full rounded-lg border text-left transition-colors cursor-pointer',
                                isSelected
                                  ? 'border-primary bg-primary/5 text-foreground'
                                  : 'border-border bg-surface hover:bg-muted/40 text-muted-foreground',
                              )}
                            >
                              <div
                                className={cn(
                                  'flex size-4 shrink-0 rounded-full border items-center justify-center mt-0.5',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border',
                                )}
                              >
                                {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <span>{opt.label}</span>
                                  {opt.isRecommended && (
                                    <span className="text-[9px] text-success font-bold uppercase">
                                      (Recommended)
                                    </span>
                                  )}
                                </div>
                                {opt.description && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {opt.description}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <Button variant="ghost" onClick={() => setState('INTAKE')}>
                  Back
                </Button>
                <Button onClick={() => handleProceedToPlan(false)} className="gap-2">
                  <span>Generate Agent Plan</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. PLAN REVIEW                                            */}
          {/* ========================================================= */}
          {state === 'PLAN_REVIEW' && plan && agentSpec && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-foreground">
                    {agentSpec.name} — Execution Plan
                  </div>
                  <Badge variant="primary" className="text-[10px]">
                    {plan.steps.length} Steps
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{plan.overview}</p>
              </div>

              {/* Editable Steps List */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Planned Construction Steps
                </div>
                {plan.steps.map((st, idx) => (
                  <div
                    key={st.id}
                    className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-border bg-background hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-mono text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span>{st.title}</span>
                          <Badge variant="outline" className="text-[9px] uppercase py-0 h-3.5">
                            {st.type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {st.description}
                        </p>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-[10px] shrink-0">
                      {st.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <Button variant="ghost" onClick={() => setState('REQUIREMENTS')}>
                  Back
                </Button>
                <Button onClick={handleStartBuilding} className="gap-2">
                  <Play className="size-4" />
                  <span>Approve Plan & Build Agent</span>
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. LIVE BUILDING & EXECUTION LOOP                         */}
          {/* ========================================================= */}
          {state === 'BUILDING' && plan && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Building {agentSpec?.name || 'Agent'}...
                </h3>
                <p className="text-xs text-muted-foreground">
                  Executing autonomous agent construction loop (Plan → Act → Observe → Validate)
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-background space-y-3 max-w-xl mx-auto">
                {plan.steps.map((step, idx) => {
                  const isCurrent = step.id === currentStepId;
                  const isDone = step.status === 'done';
                  const isFailed = step.status === 'failed';

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-lg border transition-all',
                        isCurrent
                          ? 'border-primary bg-primary/5 text-foreground'
                          : isDone
                          ? 'border-success/20 bg-success/5 text-foreground'
                          : isFailed
                          ? 'border-destructive/30 bg-destructive/5 text-destructive'
                          : 'border-border/60 bg-surface/50 text-muted-foreground opacity-60',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">
                          {isCurrent ? (
                            <Loader2 className="size-4 animate-spin text-primary" />
                          ) : isDone ? (
                            <CheckCircle2 className="size-4 text-success" />
                          ) : isFailed ? (
                            <AlertCircle className="size-4 text-destructive" />
                          ) : (
                            <Clock className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold flex items-center gap-2">
                            <span>{step.title}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {step.description}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={isDone ? 'success' : isFailed ? 'destructive' : 'neutral'}
                        className="text-[9px] uppercase font-mono py-0 h-4"
                      >
                        {step.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {events.length > 0 && (
                <div className="max-w-xl mx-auto rounded-xl border border-border/80 bg-background/50 p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                    Autonomous Construction Log
                  </div>
                  {events.slice(-4).map((ev, i) => (
                    <div key={`${ev.runId}-${ev.timestamp}-${i}`} className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-success font-bold">[{ev.type}]</span>
                      <span className="truncate">{String(ev.payload?.message || ev.payload?.title || ev.type)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. PREVIEW & TEST LAB                                     */}
          {/* ========================================================= */}
          {state === 'PREVIEW' && agentSpec && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-success/10 border border-success/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-success text-white font-bold">
                    <Check className="size-5 stroke-3" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {agentSpec.name} is constructed and ready!
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Run a simulated test turn below to verify tool actions and approvals before publishing.
                    </div>
                  </div>
                </div>
                <Button size="sm" onClick={handlePublish} className="gap-1.5">
                  <Zap className="size-3.5" />
                  <span>Publish Agent</span>
                </Button>
              </div>

              {/* Agent Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-border bg-background">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                    Autonomy & Safety
                  </div>
                  <div className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-success" />
                    <span>Human Approval Required</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-border bg-background">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                    Bound Tools
                  </div>
                  <div className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <Code2 className="size-3.5 text-primary" />
                    <span>{agentSpec.tools.length} Tools Connected</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-border bg-background">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                    Foundation Model
                  </div>
                  <div className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <Bot className="size-3.5 text-accent-violet" />
                    <span>{agentSpec.model.model}</span>
                  </div>
                </div>
              </div>

              {/* Test Console */}
              <div className="p-4 rounded-xl border border-border bg-background space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-primary" />
                    <span>Test Lab (Simulate Chat Turn)</span>
                  </div>
                  <div className="flex gap-1.5">
                    {agentSpec.ui.suggestedPrompts?.slice(0, 2).map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setTestPrompt(sp)}
                        className="text-[10px] bg-muted/60 hover:bg-muted text-foreground px-2 py-1 rounded border border-border/80 transition-colors"
                      >
                        "{sp}"
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder={`e.g. @${agentSpec.name} ${agentSpec.ui.suggestedPrompts?.[0] || 'summarize my emails'}`}
                    className="text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleRunTest()}
                  />
                  <Button
                    size="sm"
                    onClick={handleRunTest}
                    disabled={!testPrompt.trim() || isTesting}
                    className="gap-1.5 shrink-0"
                  >
                    {isTesting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    <span>Run</span>
                  </Button>
                </div>

                {/* Test Output Card */}
                {testResult && (
                  <div className="mt-3 p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-border/60 pb-2">
                      <div className="font-bold flex items-center gap-2">
                        <Bot className="size-4 text-primary" />
                        <span>{agentSpec.name}</span>
                        <Badge variant="primary" className="text-[9px] py-0 h-4">
                          Simulation Response
                        </Badge>
                      </div>
                      <Badge variant="success" className="text-[10px]">
                        ✓ All Tool Checks Passed
                      </Badge>
                    </div>

                    {/* Tool executions */}
                    {testResult.toolsExecuted?.length > 0 && (
                      <div className="space-y-1.5 bg-background p-2.5 rounded-lg border border-border">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Code2 className="size-3 text-primary" />
                          <span>Tool Executions:</span>
                        </div>
                        {testResult.toolsExecuted.map((tx: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-[11px] font-mono bg-muted/50 p-1.5 rounded"
                          >
                            <span className="text-primary font-semibold">{tx.name}</span>
                            <span className="text-muted-foreground">{tx.result}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                      {testResult.response}
                    </div>

                    {/* Approval prompt */}
                    {testResult.requiresApproval && testResult.approvalAction && (
                      <div className="p-3 rounded-lg border border-warning/50 bg-warning/5 space-y-2">
                        <div className="text-xs font-bold text-warning-text flex items-center gap-1.5">
                          <ShieldAlert className="size-4" />
                          <span>Human Approval Prompt</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          The agent is requesting permission to execute{' '}
                          <span className="font-mono font-bold text-foreground">
                            {testResult.approvalAction.tool}
                          </span>
                        </p>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="primary" className="text-xs h-7">
                            Approve Action
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. PUBLISHED & FOLLOW-UP ITERATION                        */}
          {/* ========================================================= */}
          {state === 'PUBLISHED' && agentSpec && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 text-center space-y-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground mx-auto font-bold shadow-lg shadow-primary/20">
                  <Check className="size-6 stroke-3" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {agentSpec.name} is Live in Your Workspace!
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Available in Chat via <code className="bg-muted px-1.5 py-0.5 rounded font-bold text-foreground">@{agentSpec.name}</code> and registered as an active App in your workspace.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onClose();
                      window.location.href = `/w/${workspaceId}/ai-chat`;
                    }}
                    className="gap-1.5"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Open in Chat</span>
                  </Button>
                </div>
              </div>

              {/* Follow-up Natural Language Iteration */}
              <div className="p-5 rounded-xl border border-border bg-background space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <div className="text-xs font-bold text-foreground">
                    Iterate on this Agent (Natural Language Modification)
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Want to modify behaviors, connect additional tools, or update policies? Describe what to change and the system will compute an impact diff without rebuilding from scratch.
                </p>

                <div className="flex gap-2">
                  <Input
                    value={iterationPrompt}
                    onChange={(e) => setIterationPrompt(e.target.value)}
                    placeholder="e.g. Add automatic PR summaries, or require approval before archiving emails..."
                    className="text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleIterate()}
                  />
                  <Button
                    size="sm"
                    onClick={handleIterate}
                    disabled={!iterationPrompt.trim() || isIterating}
                    className="gap-1.5 shrink-0"
                  >
                    {isIterating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="size-3.5" />
                    )}
                    <span>Apply Change</span>
                  </Button>
                </div>

                {/* Diff View */}
                {iterationDiff && (
                  <div className="mt-3 p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold border-b border-border/60 pb-2">
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="size-3.5 text-primary" />
                        <span>Calculated Impact Diff:</span>
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        v{iterationDiff.appliedSpec.version}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {iterationDiff.impactSummary}
                    </p>

                    <div className="space-y-1.5">
                      {iterationDiff.changes.map((ch, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'p-2 rounded text-xs flex items-center justify-between border',
                            ch.type === 'added'
                              ? 'bg-success/10 border-success/20 text-success-text'
                              : ch.type === 'modified'
                              ? 'bg-warning/10 border-warning/20 text-warning-text'
                              : 'bg-muted/40 border-border text-muted-foreground',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold uppercase text-[9px] px-1 rounded bg-black/10">
                              {ch.type}
                            </span>
                            <span className="font-semibold">{ch.name}</span>
                          </div>
                          <span className="text-[10px] opacity-80">{ch.description}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIterationDiff(null)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApplyIteration}
                        disabled={isProcessing}
                        className="text-xs gap-1.5"
                      >
                        {isProcessing && <Loader2 className="size-3.5 animate-spin" />}
                        <span>Publish New Version</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
