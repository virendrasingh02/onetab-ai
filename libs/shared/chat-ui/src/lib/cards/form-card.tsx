import type { FormFieldDefinition, FormMessageContent, Message } from '@org/types';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { CheckCircle2, FileText, Loader2, Send } from 'lucide-react';
import { useState } from 'react';

export interface FormCardProps {
  message: Message;
  event: FormMessageContent;
  isHighlighted?: boolean;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
}

export function FormCard({
  message,
  event,
  isHighlighted = false,
  onSubmit,
}: FormCardProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const field of event.fields) {
      if (field.defaultValue !== undefined) {
        initial[field.name] = field.defaultValue;
      }
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<FormMessageContent['status']>(event.status || 'idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (field: FormFieldDefinition, value: any): string | null => {
    if (field.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
      return `${field.label} is required`;
    }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      return 'Please enter a valid email address';
    }
    if (field.type === 'number' && value !== undefined && value !== '') {
      const num = Number(value);
      if (field.validation?.min !== undefined && num < field.validation.min) {
        return `Minimum value is ${field.validation.min}`;
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        return `Maximum value is ${field.validation.max}`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    for (const field of event.fields) {
      const err = validateField(field, formData[field.name]);
      if (err) newErrors[field.name] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the errors in the form.');
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    setStatus('submitting');

    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      setStatus('submitted');
      toast.success('Form submitted successfully!');
    } catch {
      setStatus('error');
      toast.error('Failed to submit form.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitted = status === 'submitted';

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/form relative my-2 rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-sm p-4 transition-all duration-200 shadow-xs hover:shadow-md max-w-lg',
        isSubmitted && 'border-emerald-500/40 bg-emerald-500/5',
        isHighlighted && 'ring-2 ring-primary/60',
      )}
    >
      <header className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{event.title}</h3>
            {event.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
            )}
          </div>
        </div>
        {isSubmitted && (
          <Badge variant="success" className="text-[10px] py-0 h-4 gap-1 font-semibold">
            <CheckCircle2 className="size-3" />
            <span>Submitted</span>
          </Badge>
        )}
      </header>

      {isSubmitted ? (
        <div className="mt-3 space-y-2 text-xs">
          <p className="text-muted-foreground">Responses recorded:</p>
          <div className="rounded-xl border border-border bg-surface-raised p-3 space-y-1.5 font-mono text-[11px]">
            {Object.entries(event.submittedValues || formData).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold">{k}:</span>
                <span className="text-foreground">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3 text-xs">
          {event.fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <span>{field.label}</span>
                {field.required && <span className="text-destructive">*</span>}
              </Label>

              {field.type === 'text' || field.type === 'email' || field.type === 'number' ? (
                <Input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, [field.name]: e.target.value }));
                    if (errors[field.name]) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy[field.name];
                        return copy;
                      });
                    }
                  }}
                  className={cn('text-xs h-8', errors[field.name] && 'border-destructive')}
                />
              ) : field.type === 'select' && field.options ? (
                <Select
                  value={formData[field.name] || ''}
                  onValueChange={(val) => {
                    setFormData((prev) => ({ ...prev, [field.name]: val }));
                    if (errors[field.name]) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy[field.name];
                        return copy;
                      });
                    }
                  }}
                >
                  <SelectTrigger className="text-xs h-8 bg-surface">
                    <SelectValue placeholder={field.placeholder || 'Select an option…'} />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === 'checkbox' ? (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id={field.id}
                    checked={!!formData[field.name]}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, [field.name]: !!checked }))
                    }
                  />
                  <label htmlFor={field.id} className="text-xs text-muted-foreground cursor-pointer">
                    {field.placeholder || field.label}
                  </label>
                </div>
              ) : null}

              {errors[field.name] && (
                <p className="text-[11px] text-destructive mt-0.5">{errors[field.name]}</p>
              )}
            </div>
          ))}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs px-4 gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>{event.submitLabel || 'Submit Form'}</span>
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
