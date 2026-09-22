import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  toast,
} from '@org/ui';
import { billingApi } from '@org/api-client';
import { type EnterpriseInquiryInput } from '@org/types';
import { useMutation } from '@tanstack/react-query';
import { Building, Mail, Sparkles, User } from 'lucide-react';

export interface EnterpriseContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}

export function EnterpriseContactModal({
  open,
  onOpenChange,
  workspaceId,
}: EnterpriseContactModalProps) {
  const [form, setForm] = useState<EnterpriseInquiryInput & { expectedAgents?: string; expectedExecutions?: string }>({
    name: '',
    email: '',
    companyName: '',
    teamSize: '51-200',
    customLlmRequirements: '',
    message: '',
    expectedAgents: '50+',
    expectedExecutions: '500,000+',
  });

  const enterpriseMutation = useMutation({
    mutationFn: (input: EnterpriseInquiryInput) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to submit enterprise inquiry.');
      }
      return billingApi.submitEnterpriseInquiry(workspaceId, input);
    },
    onSuccess: (res) => {
      toast.success(
        res.message || 'Thank you! Our enterprise solution architects will contact you within 24 hours.',
      );
      onOpenChange(false);
      setForm({
        name: '',
        email: '',
        companyName: '',
        teamSize: '51-200',
        customLlmRequirements: '',
        message: '',
        expectedAgents: '50+',
        expectedExecutions: '500,000+',
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit enterprise inquiry. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.companyName.trim()) {
      toast.error('Please fill in your name, work email, and company name.');
      return;
    }

    const compiledMessage = [
      form.message,
      form.expectedAgents ? `Expected Micro Agents: ${form.expectedAgents}` : '',
      form.expectedExecutions ? `Expected Monthly Executions: ${form.expectedExecutions}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    enterpriseMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      companyName: form.companyName.trim(),
      teamSize: form.teamSize,
      customLlmRequirements: form.customLlmRequirements?.trim(),
      message: compiledMessage,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-6 border-b border-border/80">
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1">
                <Sparkles className="size-4" />
                Custom Solutions
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Connect with Enterprise Sales
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Get dedicated infrastructure, custom LLM fine-tuning, SLA guarantees, and unlimited micro-agents.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="size-3.5 text-muted-foreground" />
                  Your Name *
                </label>
                <Input
                  required
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Work Email *
                </label>
                <Input
                  required
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Building className="size-3.5 text-muted-foreground" />
                  Company Name *
                </label>
                <Input
                  required
                  placeholder="Acme Corp"
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Team Size
                </label>
                <select
                  aria-label="Team Size"
                  value={form.teamSize}
                  onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="1-20">1 - 20 employees</option>
                  <option value="21-50">21 - 50 employees</option>
                  <option value="51-200">51 - 200 employees</option>
                  <option value="201-1000">201 - 1,000 employees</option>
                  <option value="1000+">1,000+ enterprise</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Expected Micro Agents
                </label>
                <Input
                  placeholder="e.g. 50+ agents"
                  value={form.expectedAgents}
                  onChange={(e) =>
                    setForm({ ...form, expectedAgents: e.target.value })
                  }
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Expected Monthly Executions
                </label>
                <Input
                  placeholder="e.g. 1M+ executions"
                  value={form.expectedExecutions}
                  onChange={(e) =>
                    setForm({ ...form, expectedExecutions: e.target.value })
                  }
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Custom LLM & Security Requirements
              </label>
              <Input
                placeholder="e.g. Self-hosted Ollama, Azure OpenAI endpoint, Private VPC, HIPAA"
                value={form.customLlmRequirements}
                onChange={(e) =>
                  setForm({ ...form, customLlmRequirements: e.target.value })
                }
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Project & Scale Notes
              </label>
              <Textarea
                rows={3}
                placeholder="Tell us about your micro-agent workflow architecture and security requirements..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-surface-muted/30 flex justify-end gap-2">
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
              variant="primary"
              size="sm"
              disabled={enterpriseMutation.isPending}
            >
              {enterpriseMutation.isPending ? 'Submitting...' : 'Submit Inquiry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
