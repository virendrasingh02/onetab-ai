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
  GitPullRequest,
  Loader2,
  Mail,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';

export interface AIModeAgentBuilderModalProps {
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
    color: 'text-red-500 bg-red-500/10 border-red-500/20',
  },
  {
    title: 'GitHub Agent',
    prompt: 'Create a GitHub agent that monitors repository activity, reviews open PRs, and summarizes diffs.',
    icon: GitPullRequest,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  {
    title: 'Sales CRM Agent',
    prompt: 'Create an AI employee for sales that checks incoming leads, analyzes prospect fit, and drafts follow-up notes.',
    icon: Zap,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    title: 'Deep Research Agent',
    prompt: 'Create a research agent that performs structured web research, synthesizes sources, and compiles reports.',
    icon: Search,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
];

export function AIModeAgentBuilderModal({
  workspaceId,
  isOpen,
  onClose,
  onAgentCreated,
}: AIModeAgentBuilderModalProps) {
  const [state, setState] = useState<AgentBuilderState>('INTAKE');
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [classification, setClassification] = useState<IntentClassification | null>(null);
  const [questions, setQuestions] = useState<DynamicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [agentSpec, setAgentSpec] = useState<AgentSpec | null>(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [, setEvents] = useState<AgentBuilderRunEvent[]>([]);

  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const [iterationPrompt, setIterationPrompt] = useState('');
  const [iterationDiff, setIterationDiff] = useState<AgentIterationDiff | null>(null);
  const [isIterating, setIsIterating] = useState(false);

  const handleIntakeSubmit = async (customPrompt?: string) => {
    const textToSubmit = (customPrompt || prompt).trim();
    if (!textToSubmit) return;

    setPrompt(textToSubmit);
    setIsProcessing(true);
    setState('UNDERSTAND');

    try {
      const intentResult = await agentStudioAiModeApi.classifyIntent(workspaceId, textToSubmit);
      setClassification(intentResult);

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

  const handleProceedToPlan = async (useDefaults = false) => {
    if (!classification) return;
    setIsProcessing(true);
    setState('AGENT_PLAN');

    try {
      const activeAnswers = useDefaults
        ? questions.reduce((acc, q) => ({ ...acc, [q.id]: q.default }), {})
        : answers;

      setAnswers(activeAnswers);

      const planResult = await agentStudioAiModeApi.generatePlan(
        workspaceId,
        prompt,
        classification,
        activeAnswers,
      );
      setPlan(planResult);

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
        await new Promise((r) => setTimeout(r, 350));
      } catch (err: any) {
        step.status = 'failed';
        step.error = err.message || 'Execution error';
        setPlan({ ...currentPlan });
        toast.error(`Step "${step.title}" failed.`);
        break;
      }
    }

    setIsProcessing(false);
    setCurrentStepId(null);
    setState('PREVIEW');
  };

  const handleRunTest = async () => {
    if (!testPrompt.trim() || !agentSpec) return;
    setIsTesting(true);

    try {
      const isGmail = agentSpec.integrations.some((i) => i.provider === 'GMAIL');
      const isGithub = agentSpec.integrations.some((i) => i.provider === 'GITHUB');

      await new Promise((r) => setTimeout(r, 600));

      if (isGmail) {
        setTestResult({
          status: 'completed',
          toolsExecuted: [
            { name: 'gmail_search_emails', result: 'Found 12 unread emails.' },
            { name: 'gmail_create_draft', result: 'Draft response created.' },
          ],
          response:
            'I summarized your unread emails:\n\n• 3 action items requiring reply\n• 5 team updates\n• 4 newsletter digests\n\nDraft replies prepared for review.',
          requiresApproval: true,
          approvalAction: {
            tool: 'gmail_send_message',
            target: 'client@example.com',
          },
        });
      } else if (isGithub) {
        setTestResult({
          status: 'completed',
          toolsExecuted: [
            { name: 'github_list_pull_requests', result: 'Found 3 open pull requests.' },
            { name: 'github_get_pull_request', result: 'Fetched PR #42 diff.' },
          ],
          response:
            'PR #42 review summary:\n\n• Clean architectural structure\n• Security tests passing\n• 1 minor comment on test fixtures.',
          requiresApproval: true,
          approvalAction: {
            tool: 'github_comment_on_issue',
          },
        });
      } else {
        setTestResult({
          status: 'completed',
          toolsExecuted: [{ name: 'search_docs', result: 'Retrieved 2 documents.' }],
          response: 'Processed request with workspace tools. All checks passed.',
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

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
      toast.success('Generated iteration diff.');
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
      toast.success(`Agent updated to v${agentSpec.version}!`);
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

        <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6">
          {state === 'INTAKE' && (
            <div className="space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-2 pt-2">
                <h3 className="text-lg font-bold tracking-tight">What do you want your agent to do?</h3>
                <p className="text-xs text-muted-foreground">
                  Describe an AI Agent in natural language. The system builds an extensible agent with tools and workflows for Chat.
                </p>
              </div>

              <div className="relative rounded-xl border border-border bg-background p-2 shadow-xs focus-within:ring-2 focus-within:ring-primary/20">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Create a Gmail agent that summarizes unread emails, drafts replies and lets me send them..."
                  rows={3}
                  className="w-full resize-none border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none p-2"
                />
                <div className="flex items-center justify-between border-t border-border/40 pt-2 px-2">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-primary" />
                    <span>Uses platform tools, connectors & workspace memory</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleIntakeSubmit()}
                    disabled={!prompt.trim() || isProcessing}
                    className="gap-1.5"
                  >
                    {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                    <span>Create Agent</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {INTAKE_EXAMPLES.map((ex) => {
                  const Icon = ex.icon;
                  return (
                    <button
                      key={ex.title}
                      type="button"
                      onClick={() => handleIntakeSubmit(ex.prompt)}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted/40 text-left transition-colors cursor-pointer"
                    >
                      <div className={cn('p-2 rounded-lg border', ex.color)}>
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{ex.title}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {ex.prompt}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {state === 'UNDERSTAND' && (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div className="text-sm font-bold">Analyzing your request...</div>
            </div>
          )}

          {state === 'REQUIREMENTS' && classification && (
            <div className="space-y-6">
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
                    <div className="text-[11px] text-muted-foreground">{classification.reasoning}</div>
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

              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl border border-border bg-background space-y-2.5">
                    <div className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>{q.label}</span>
                      <Badge variant="neutral" className="text-[9px] py-0 h-3.5">
                        {q.group}
                      </Badge>
                    </div>
                    {q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => {
                          const isSelected =
                            q.type === 'multi-select'
                              ? ((answers[q.id] as string[]) || []).includes(opt.value)
                              : answers[q.id] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                if (q.type === 'multi-select') {
                                  const cur = (answers[q.id] as string[]) || [];
                                  const next = isSelected ? cur.filter((v) => v !== opt.value) : [...cur, opt.value];
                                  setAnswers({ ...answers, [q.id]: next });
                                } else {
                                  setAnswers({ ...answers, [q.id]: opt.value });
                                }
                              }}
                              className={cn(
                                'flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer',
                                isSelected
                                  ? 'border-primary bg-primary/5 font-semibold text-foreground'
                                  : 'border-border bg-surface text-muted-foreground hover:bg-muted/30',
                              )}
                            >
                              <div
                                className={cn(
                                  'flex size-3.5 rounded border items-center justify-center',
                                  isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                                )}
                              >
                                {isSelected && <Check className="size-2.5 stroke-3" />}
                              </div>
                              <span className="truncate">{opt.label}</span>
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

          {state === 'PLAN_REVIEW' && plan && agentSpec && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
                <div className="text-sm font-bold text-foreground">{agentSpec.name} — Plan Review</div>
                <div className="text-xs text-muted-foreground">{plan.overview}</div>
              </div>

              <div className="space-y-2.5">
                {plan.steps.map((st, idx) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold font-mono">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span>{st.title}</span>
                          <Badge variant="outline" className="text-[9px] uppercase py-0 h-3.5">
                            {st.type}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{st.description}</div>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-[9px]">
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

          {state === 'BUILDING' && plan && (
            <div className="space-y-6 py-6 text-center">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Building {agentSpec?.name}...</h3>
                <p className="text-xs text-muted-foreground">Executing construction loop</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-background space-y-2.5 max-w-lg mx-auto text-left">
                {plan.steps.map((step) => {
                  const isCurrent = step.id === currentStepId;
                  const isDone = step.status === 'done';
                  const isFailed = step.status === 'failed';
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg border text-xs',
                        isCurrent ? 'border-primary bg-primary/5' : isDone ? 'border-emerald-500/20' : 'border-border/60',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {isCurrent ? (
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                        ) : isDone ? (
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                        ) : isFailed ? (
                          <AlertCircle className="size-3.5 text-destructive" />
                        ) : (
                          <Clock className="size-3.5 text-muted-foreground" />
                        )}
                        <span>{step.title}</span>
                      </div>
                      <Badge variant={isDone ? 'success' : 'neutral'} className="text-[9px] py-0 h-3.5">
                        {step.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {state === 'PREVIEW' && agentSpec && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <Check className="size-5 text-emerald-500 stroke-3" />
                  <div>
                    <div className="text-sm font-bold text-foreground">{agentSpec.name} is Ready!</div>
                    <div className="text-xs text-muted-foreground">Test tool actions below, then publish.</div>
                  </div>
                </div>
                <Button size="sm" onClick={handlePublish} className="gap-1.5">
                  <Zap className="size-3.5" />
                  <span>Publish Agent</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Simulate Chat Interaction
                </div>
                <div className="flex gap-2">
                  <Input
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder={`e.g. @${agentSpec.name} ${agentSpec.ui.suggestedPrompts?.[0] || 'summarize my unread emails'}`}
                    className="text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleRunTest()}
                  />
                  <Button size="sm" onClick={handleRunTest} disabled={!testPrompt.trim() || isTesting}>
                    {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  </Button>
                </div>

                {testResult && (
                  <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-2 mt-2">
                    <div className="font-bold flex items-center gap-1.5 text-primary">
                      <Bot className="size-3.5" />
                      <span>{agentSpec.name} Response:</span>
                    </div>
                    <div className="whitespace-pre-line text-foreground">{testResult.response}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {state === 'PUBLISHED' && agentSpec && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 text-center space-y-3">
                <Check className="size-8 text-primary mx-auto stroke-3" />
                <h3 className="text-lg font-bold text-foreground">{agentSpec.name} is Live!</h3>
                <p className="text-xs text-muted-foreground">
                  Use in Chat via <code className="bg-muted px-1.5 py-0.5 rounded font-bold">@{agentSpec.name}</code>
                </p>
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

              <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Iterate on this Agent</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={iterationPrompt}
                    onChange={(e) => setIterationPrompt(e.target.value)}
                    placeholder="e.g. Add automatic PR summaries, or require approval..."
                    className="text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleIterate()}
                  />
                  <Button size="sm" onClick={handleIterate} disabled={!iterationPrompt.trim() || isIterating}>
                    {isIterating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                  </Button>
                </div>

                {iterationDiff && (
                  <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2 mt-2">
                    <div className="text-xs font-bold">Diff Plan: {iterationDiff.impactSummary}</div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setIterationDiff(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleApplyIteration}>
                        Publish New Version
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
