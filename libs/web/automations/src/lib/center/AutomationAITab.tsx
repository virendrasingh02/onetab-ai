import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
} from '@org/ui';
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
      return nodes.some((n: any) => ['AI_PROMPT', 'AGENT', 'TOOL'].includes(n.data?.type));
    } catch {
      return false;
    }
  });

  const aiTemplates = WORKFLOW_TEMPLATES.filter((t) => t.category === 'ai');

  return (
    <div className="space-y-6">
      {/* Intro Hero Banner */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-primary/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <BrainCircuit className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-lg text-foreground">
                AI-Powered Autonomous Workflows
              </h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Combine multi-step deterministic workflow logic with intelligent LLM classification, structured JSON extraction, knowledge retrieval, and autonomous AI Agent coworker delegations.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
              onClick={() => navigate(`/w/${slug}/automations/builder/new?trigger=MANUAL&type=ai`)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New AI Automation
            </Button>
          </div>
        </div>
      </Card>

      {/* Safety & Guardrails Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h4 className="font-semibold text-sm text-foreground">Human-in-the-Loop</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sensitive actions (publishing, sending outbound messages, modifying billing) can require explicit person confirmation before resuming the run.
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-2 mb-1.5">
            <Lock className="h-4 w-4 text-indigo-600" />
            <h4 className="font-semibold text-sm text-foreground">Schema Validation</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Model outputs are strictly validated against JSON schemas before downstream nodes execute, preventing hallucinated parameters.
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 mb-1.5">
            <Cpu className="h-4 w-4 text-amber-600" />
            <h4 className="font-semibold text-sm text-foreground">Budget & Token Limits</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Token quotas and execution timeouts prevent runaway loops or unexpected API provider consumption across long chains.
          </p>
        </Card>
      </div>

      {/* Active AI Workflows in Workspace */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-base text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Active AI Workflows in this Workspace ({aiWorkflows.length})
          </h4>
        </div>

        {aiWorkflows.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              No AI-powered automations created yet. Start with a ready-made template below.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/w/${slug}/automations/builder/new?trigger=MANUAL&type=ai`)}
            >
              Build an AI Automation
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiWorkflows.map((w) => (
              <Card key={w.id} className="p-4 flex items-center justify-between hover:border-primary/50 transition-colors">
                <div>
                  <h5 className="font-semibold text-sm text-foreground">{w.name}</h5>
                  <p className="text-xs text-muted-foreground line-clamp-1">{w.description ?? 'AI automation'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={w.isActive ? 'primary' : 'secondary'} className="text-[10px]">
                    {w.isActive ? 'Active' : 'Paused'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => navigate(`/w/${slug}/automations/builder/${w.id}`)}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiTemplates.map((tpl) => (
            <Card key={tpl.id} className="p-4 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div>
                <span className="text-2xl mb-2 block">🤖</span>
                <h5 className="font-semibold text-sm text-foreground mb-1">{tpl.name}</h5>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="text-[11px] text-primary font-medium">Saves ~{tpl.estimatedTimeSaved}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => navigate(`/w/${slug}/automations?tab=templates`)}
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
