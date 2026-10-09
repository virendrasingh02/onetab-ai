import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  toast,
} from '@org/ui';
import type { Edge, Node } from '@xyflow/react';
import { Download, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface TemplateExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  agentName?: string;
}

export function TemplateExportModal({
  isOpen,
  onClose,
  nodes,
  edges,
  agentName = 'Agent Workflow',
}: TemplateExportModalProps) {
  const [templateName, setTemplateName] = useState(`${agentName} Template`);
  const [description, setDescription] = useState(
    'Reusable AI agent workflow blueprint with connected reasoning steps and tool configurations.',
  );
  const [category, setCategory] = useState('Customer Support');
  const [author, setAuthor] = useState('Workspace Member');

  const handleExport = () => {
    const templateData = {
      name: templateName.trim() || 'Workflow Template',
      description: description.trim(),
      category: category.trim(),
      author: author.trim(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      schemaVersion: '2.0',
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        data: e.data,
      })),
    };

    const blob = new Blob([JSON.stringify(templateData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-template.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Template "${templateName}" exported successfully!`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-surface shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Save as Reusable Template</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Export this agent workflow configuration as a reusable component
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3.5 py-2">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Template Name
            </label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Lead Qualification Agent"
              className="text-xs h-8"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow automates..."
              className="text-xs min-h-[70px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Category
              </label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Author
              </label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author"
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="rounded-lg bg-surface-raised/50 border border-border/80 p-2.5 text-[11px] text-muted-foreground">
            Contains <span className="font-semibold text-foreground">{nodes.length} nodes</span> and{' '}
            <span className="font-semibold text-foreground">{edges.length} connections</span>. Sensitive credentials and secrets are stripped automatically for security.
          </div>
        </DialogBody>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="size-3.5" />
            <span>Export Template</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
