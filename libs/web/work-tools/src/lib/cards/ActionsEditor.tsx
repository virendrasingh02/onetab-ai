import type { CardActionDefinition, CardActionType } from '@org/types';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { Plus, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';

export interface ActionsEditorProps {
  actions: CardActionDefinition[];
  onChange: (actions: CardActionDefinition[]) => void;
}

export function ActionsEditor({ actions = [], onChange }: ActionsEditorProps) {
  const [newActionId, setNewActionId] = useState('');
  const [newActionLabel, setNewActionLabel] = useState('');
  const [newActionType, setNewActionType] =
    useState<CardActionType>('open_url');

  const handleAddAction = () => {
    const id = newActionId.trim().replace(/\s+/g, '_');
    if (!id || !newActionLabel.trim()) return;

    const newAction: CardActionDefinition = {
      id,
      label: newActionLabel,
      type: newActionType,
      variant: newActionType === 'reject' ? 'destructive' : 'primary',
    };

    onChange([...actions, newAction]);
    setNewActionId('');
    setNewActionLabel('');
  };

  const handleRemoveAction = (actionId: string) => {
    onChange(actions.filter((a) => a.id !== actionId));
  };

  const handleUpdateAction = (
    actionId: string,
    updates: Partial<CardActionDefinition>,
  ) => {
    onChange(
      actions.map((a) => (a.id === actionId ? { ...a, ...updates } : a)),
    );
  };

  return (
    <div className="p-4 space-y-4 flex h-full flex-col overflow-y-auto border-l border-border/60 bg-surface">
      <div>
        <span className="text-xs font-bold block text-foreground">
          Card Action Registry
        </span>
        <p className="text-meta text-muted-foreground">
          Define interactive actions with confirmation dialogs, permissions
          guards, and API callbacks.
        </p>
      </div>

      {/* Add Action Form */}
      <div className="p-3 space-y-2 rounded-xl border border-border/70 bg-surface-raised">
        <span className="text-xs font-bold block text-foreground">
          + Add Card Action
        </span>
        <div className="gap-2 grid grid-cols-2">
          <Input
            placeholder="Action ID (e.g. open_crm)"
            value={newActionId}
            onChange={(e) => setNewActionId(e.target.value)}
            className="text-xs h-8 font-mono"
          />
          <Input
            placeholder="Label (e.g. Open in CRM)"
            value={newActionLabel}
            onChange={(e) => setNewActionLabel(e.target.value)}
            className="text-xs h-8"
          />
        </div>
        <div className="gap-2 flex items-center">
          <Select
            value={newActionType}
            onValueChange={(val: any) => setNewActionType(val)}
          >
            <SelectTrigger className="text-xs h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="open_url">Open URL</SelectItem>
              <SelectItem value="call_api">Call API Endpoint</SelectItem>
              <SelectItem value="send_message">Send Chat Message</SelectItem>
              <SelectItem value="run_agent">Run AI Agent</SelectItem>
              <SelectItem value="run_workflow">Run Workflow</SelectItem>
              <SelectItem value="update_record">Update Record</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
              <SelectItem value="copy_value">Copy Value</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAddAction}
            className="text-xs h-8 gap-1"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Action Items List */}
      <div className="space-y-3">
        {actions.map((act) => (
          <div
            key={act.id}
            className="p-3 space-y-2 rounded-xl border border-border/60 bg-surface-raised"
          >
            <div className="flex items-center justify-between">
              <div className="gap-1.5 text-xs font-bold flex items-center font-mono text-foreground">
                <Zap className="size-3 text-primary" />
                <span>{act.id}</span>
                <span className="px-1.5 py-0.5 rounded border border-border/60 bg-surface text-2xs text-muted-foreground uppercase">
                  {act.type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAction(act.id)}
                className="p-1 rounded text-destructive-text hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="gap-2 grid grid-cols-2">
              <div>
                <Label className="text-2xs text-muted-foreground">Label</Label>
                <Input
                  value={act.label}
                  onChange={(e) =>
                    handleUpdateAction(act.id, { label: e.target.value })
                  }
                  className="text-xs h-7"
                />
              </div>
              <div>
                <Label className="text-2xs text-muted-foreground">
                  Button Variant
                </Label>
                <Select
                  value={act.variant || 'primary'}
                  onValueChange={(val: any) =>
                    handleUpdateAction(act.id, { variant: val })
                  }
                >
                  <SelectTrigger className="text-xs h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                    <SelectItem value="ghost">Ghost</SelectItem>
                    <SelectItem value="destructive">Destructive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {act.type === 'open_url' && (
              <div>
                <Label className="text-2xs text-muted-foreground">
                  Target URL Template
                </Label>
                <Input
                  value={act.url || ''}
                  onChange={(e) =>
                    handleUpdateAction(act.id, { url: e.target.value })
                  }
                  placeholder="https://… or {{url}}"
                  className="text-xs h-7 font-mono"
                />
              </div>
            )}

            <div className="gap-2 pt-1 flex items-center">
              <Checkbox
                id={`conf-${act.id}`}
                checked={act.requiresConfirmation}
                onCheckedChange={(c) =>
                  handleUpdateAction(act.id, {
                    requiresConfirmation: Boolean(c),
                  })
                }
              />
              <label
                htmlFor={`conf-${act.id}`}
                className="text-xs cursor-pointer text-foreground select-none"
              >
                Require Confirmation Dialog
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
