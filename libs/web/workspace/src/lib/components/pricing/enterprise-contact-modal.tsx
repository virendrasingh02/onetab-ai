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
  AppSelect,
  Field,
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
  const [form, setForm] = useState<
    EnterpriseInquiryInput & {
      expectedAgents?: string;
      expectedExecutions?: string;
    }
  >({
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
        throw new Error(
          'Workspace ID is required to submit enterprise inquiry.',
        );
      }
      return billingApi.submitEnterpriseInquiry(workspaceId, input);
    },
    onSuccess: (res) => {
      toast.success(
        res.message ||
          'Thank you! Our enterprise solution architects will contact you within 24 hours.',
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
      toast.error(
        err.message || 'Failed to submit enterprise inquiry. Please try again.',
      );
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
      form.expectedAgents
        ? `Expected Micro Agents: ${form.expectedAgents}`
        : '',
      form.expectedExecutions
        ? `Expected Monthly Executions: ${form.expectedExecutions}`
        : '',
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
          <div className="p-6 border-b border-border/80 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent">
            <DialogHeader>
              <div className="gap-2 text-xs font-bold tracking-wider mb-1 flex items-center text-primary uppercase">
                <Sparkles className="size-4" />
                Custom Solutions
              </div>
              <DialogTitle className="text-xl font-semibold text-foreground">
                Connect with Enterprise Sales
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Get dedicated infrastructure, custom LLM fine-tuning, SLA
                guarantees, and unlimited micro-agents.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
              <Field
                label={
                  <>
                    <User className="size-3.5 text-muted-foreground" /> Your
                    Name
                  </>
                }
                required
              >
                <Input
                  required
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              <Field
                label={
                  <>
                    <Mail className="size-3.5 text-muted-foreground" /> Work
                    Email
                  </>
                }
                required
              >
                <Input
                  required
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>

            <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
              <Field
                label={
                  <>
                    <Building className="size-3.5 text-muted-foreground" />{' '}
                    Company Name
                  </>
                }
                required
              >
                <Input
                  required
                  placeholder="Acme Corp"
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                />
              </Field>

              <Field label="Team Size">
                <AppSelect
                  aria-label="Team Size"
                  value={form.teamSize}
                  onValueChange={(v) => setForm({ ...form, teamSize: v })}
                  options={[
                    { value: '1-20', label: '1 - 20 employees' },
                    { value: '21-50', label: '21 - 50 employees' },
                    { value: '51-200', label: '51 - 200 employees' },
                    { value: '201-1000', label: '201 - 1,000 employees' },
                    { value: '1000+', label: '1,000+ enterprise' },
                  ]}
                />
              </Field>
            </div>

            <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
              <Field label="Expected Micro Agents">
                <Input
                  placeholder="e.g. 50+ agents"
                  value={form.expectedAgents}
                  onChange={(e) =>
                    setForm({ ...form, expectedAgents: e.target.value })
                  }
                />
              </Field>

              <Field label="Expected Monthly Executions">
                <Input
                  placeholder="e.g. 1M+ executions"
                  value={form.expectedExecutions}
                  onChange={(e) =>
                    setForm({ ...form, expectedExecutions: e.target.value })
                  }
                />
              </Field>
            </div>

            <Field label="Custom LLM & Security Requirements">
              <Input
                placeholder="e.g. Self-hosted Ollama, Azure OpenAI endpoint, Private VPC, HIPAA"
                value={form.customLlmRequirements}
                onChange={(e) =>
                  setForm({ ...form, customLlmRequirements: e.target.value })
                }
              />
            </Field>

            <Field label="Project & Scale Notes">
              <Textarea
                rows={3}
                placeholder="Tell us about your micro-agent workflow architecture and security requirements..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="resize-none"
              />
            </Field>
          </div>

          <DialogFooter className="p-4 gap-2 flex justify-end border-t border-border bg-surface-muted/30">
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
              {enterpriseMutation.isPending
                ? 'Submitting...'
                : 'Submit Inquiry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
