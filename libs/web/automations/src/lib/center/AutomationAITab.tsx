import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Cpu,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useWorkflows } from '../use-automations.js';
import { WORKFLOW_TEMPLATES } from '../workflow-templates.js';

export function AutomationAITab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const workflowsQuery = useWorkflows(workspaceId);

  const workflows = workflowsQuery.data ?? [];
  const aiWorkflows = workflows.filter((w) => {
    try {
      const nodes = JSON.parse(w.nodesJson ?? '[]');
      return nodes.some((n: any) =>
        ['AI_PROMPT', 'AGENT', 'TOOL'].includes(n.data?.type),
      );
    } catch {
      return false;
    }
  });

  const aiTemplates = WORKFLOW_TEMPLATES.filter((t) => t.category === 'ai');

  return (
    <div className="space-y-6">
      {/* Intro Hero Banner */}
      <Card className="p-6 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent">
        <div className="md:flex-row md:items-center gap-4 flex flex-col items-start justify-between">
          <div className="space-y-1">
            <div className="gap-2 flex items-center">
              <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <BrainCircuit className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-lg text-foreground">
                AI-Powered Autonomous Workflows
              </h3>
            </div>
            <p className="text-sm max-w-2xl leading-relaxed text-muted-foreground">
              Combine multi-step deterministic workflow logic with intelligent
              LLM classification, structured JSON extraction, knowledge
              retrieval, and autonomous AI Agent coworker delegations.
            </p>
          </div>

          <div className="gap-2 flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/w/${slug}/ai`)}
            >
              <Bot className="h-4 w-4 mr-1.5" />
              Agent Studio
            </Button>
            <Button
              size="sm"
              onClick={() =>
                navigate(
                  `/w/${slug}/automations/builder/new?trigger=MANUAL&type=ai`,
                )
              }
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New AI Automation
            </Button>
          </div>
        </div>
      </Card>

      {/* Safety & Guardrails Overview */}
      <div className="md:grid-cols-3 gap-4 grid grid-cols-1">
        <Card className="p-4 border-l-4 border-l-success">
          <div className="gap-2 mb-1.5 flex items-center">
            <ShieldCheck className="h-4 w-4 text-success-text" />
            <h4 className="font-semibold text-sm text-foreground">
              Human-in-the-Loop
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sensitive actions (publishing, sending outbound messages, modifying
            billing) can require explicit person confirmation before resuming
            the run.
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-accent-indigo">
          <div className="gap-2 mb-1.5 flex items-center">
            <Lock className="h-4 w-4 text-accent-indigo" />
            <h4 className="font-semibold text-sm text-foreground">
              Schema Validation
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Model outputs are strictly validated against JSON schemas before
            downstream nodes execute, preventing hallucinated parameters.
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-warning">
          <div className="gap-2 mb-1.5 flex items-center">
            <Cpu className="h-4 w-4 text-warning-text" />
            <h4 className="font-semibold text-sm text-foreground">
              Budget & Token Limits
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Token quotas and execution timeouts prevent runaway loops or
            unexpected API provider consumption across long chains.
          </p>
        </Card>
      </div>

      {/* Active AI Workflows in Workspace */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-base gap-2 flex items-center text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Active AI Workflows in this Workspace ({aiWorkflows.length})
          </h4>
        </div>

        {aiWorkflows.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm mb-3 text-muted-foreground">
              No AI-powered automations created yet. Start with a ready-made
              template below.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate(
                  `/w/${slug}/automations/builder/new?trigger=MANUAL&type=ai`,
                )
              }
            >
              Build an AI Automation
            </Button>
          </Card>
        ) : (
          <div className="md:grid-cols-2 gap-3 grid grid-cols-1">
            {aiWorkflows.map((w) => (
              <Card
                key={w.id}
                className="p-4 flex items-center justify-between transition-colors hover:border-primary/50"
              >
                <div>
                  <h5 className="font-semibold text-sm text-foreground">
                    {w.name}
                  </h5>
                  <p className="text-xs line-clamp-1 text-muted-foreground">
                    {w.description ?? 'AI automation'}
                  </p>
                </div>
                <div className="gap-2 flex items-center">
                  <Badge
                    variant={w.isActive ? 'primary' : 'secondary'}
                    className="text-2xs"
                  >
                    {w.isActive ? 'Active' : 'Paused'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() =>
                      navigate(`/w/${slug}/automations/builder/${w.id}`)
                    }
                  >
                    Open
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recommended AI Templates */}
      <div className="space-y-3">
        <h4 className="font-semibold text-base text-foreground">
          Recommended AI Automation Starters
        </h4>
        <div className="md:grid-cols-3 gap-4 grid grid-cols-1">
          {aiTemplates.map((tpl) => (
            <Card
              key={tpl.id}
              className="p-4 flex flex-col justify-between transition-colors hover:border-primary/40"
            >
              <div>
                <span className="text-2xl mb-2 block">🤖</span>
                <h5 className="font-semibold text-sm mb-1 text-foreground">
                  {tpl.name}
                </h5>
                <p className="text-xs mb-3 leading-relaxed line-clamp-2 text-muted-foreground">
                  {tpl.description}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/50">
                <span className="font-medium text-meta text-primary">
                  Saves ~{tpl.estimatedTimeSaved}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() =>
                    navigate(`/w/${slug}/automations?tab=templates`)
                  }
                >
                  View Template
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
