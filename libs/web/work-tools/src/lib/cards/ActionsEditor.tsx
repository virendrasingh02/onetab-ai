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
  const [newActionType, setNewActionType] = useState<CardActionType>('open_url');

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

  const handleUpdateAction = (actionId: string, updates: Partial<CardActionDefinition>) => {
    onChange(actions.map((a) => (a.id === actionId ? { ...a, ...updates } : a)));
  };

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border/60 overflow-y-auto p-4 space-y-4">
      <div>
        <span className="text-xs font-bold text-foreground block">Card Action Registry</span>
        <p className="text-[11px] text-muted-foreground">
          Define interactive actions with confirmation dialogs, permissions guards, and API callbacks.
        </p>
      </div>

      {/* Add Action Form */}
      <div className="p-3 rounded-xl border border-border/70 bg-surface-raised space-y-2">
        <span className="text-xs font-bold text-foreground block">+ Add Card Action</span>
        <div className="grid grid-cols-2 gap-2">
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
        <div className="flex items-center gap-2">
          <Select value={newActionType} onValueChange={(val: any) => setNewActionType(val)}>
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
          <Button size="sm" onClick={handleAddAction} className="text-xs h-8 gap-1">
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Action Items List */}
      <div className="space-y-3">
        {actions.map((act) => (
          <div key={act.id} className="p-3 rounded-xl border border-border/60 bg-surface-raised space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                <Zap className="size-3 text-primary" />
                <span>{act.id}</span>
                <span className="text-[10px] text-muted-foreground uppercase bg-surface px-1.5 py-0.5 rounded border border-border/60">
                  {act.type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAction(act.id)}
                className="text-destructive-text hover:text-destructive p-1 rounded"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Label</Label>
                <Input
                  value={act.label}
                  onChange={(e) => handleUpdateAction(act.id, { label: e.target.value })}
                  className="text-xs h-7"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Button Variant</Label>
                <Select
                  value={act.variant || 'primary'}
                  onValueChange={(val: any) => handleUpdateAction(act.id, { variant: val })}
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
                <Label className="text-[10px] text-muted-foreground">Target URL Template</Label>
                <Input
                  value={act.url || ''}
                  onChange={(e) => handleUpdateAction(act.id, { url: e.target.value })}
                  placeholder="https://… or {{url}}"
                  className="text-xs h-7 font-mono"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={`conf-${act.id}`}
                checked={act.requiresConfirmation}
                onCheckedChange={(c) => handleUpdateAction(act.id, { requiresConfirmation: Boolean(c) })}
              />
              <label htmlFor={`conf-${act.id}`} className="text-xs text-foreground cursor-pointer select-none">
                Require Confirmation Dialog
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
