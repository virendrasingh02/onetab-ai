import type { CardDataField, CardDataSchema, CardFieldType } from '@org/types';
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
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

export interface SchemaEditorProps {
  schema: CardDataSchema;
  onChange: (schema: CardDataSchema) => void;
}

export function SchemaEditor({ schema, onChange }: SchemaEditorProps) {
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CardFieldType>('string');

  const fields = schema?.fields || {};

  const handleAddField = () => {
    const name = newFieldName.trim().replace(/\s+/g, '_');
    if (!name) return;

    const newField: CardDataField = {
      name,
      label: newFieldLabel || name,
      type: newFieldType,
      defaultValue: newFieldType === 'number' ? 0 : newFieldType === 'boolean' ? false : '',
    };

    onChange({
      fields: {
        ...fields,
        [name]: newField,
      },
    });

    setNewFieldName('');
    setNewFieldLabel('');
  };

  const handleRemoveField = (fieldName: string) => {
    const updated = { ...fields };
    delete updated[fieldName];
    onChange({ fields: updated });
  };

  const handleUpdateField = (fieldName: string, updates: Partial<CardDataField>) => {
    onChange({
      fields: {
        ...fields,
        [fieldName]: {
          ...fields[fieldName],
          ...updates,
        },
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border/60 overflow-y-auto p-4 space-y-4">
      <div>
        <span className="text-xs font-bold text-foreground block">Data Schema &amp; Fields</span>
        <p className="text-[11px] text-muted-foreground">
          Define strongly-typed input fields that AI agents, workflows, and Matrix users can populate.
        </p>
      </div>

      {/* Add New Field Box */}
      <div className="p-3 rounded-xl border border-border/70 bg-surface-raised space-y-2">
        <span className="text-xs font-bold text-foreground block">+ Add Data Field</span>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Field Key (e.g. name)"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            className="text-xs h-8 font-mono"
          />
          <Input
            placeholder="Label (e.g. Full Name)"
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            className="text-xs h-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={newFieldType} onValueChange={(val: any) => setNewFieldType(val)}>
            <SelectTrigger className="text-xs h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="string">String (Text)</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="currency">Currency</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="url">URL</SelectItem>
              <SelectItem value="enum">Enum (Select options)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAddField} className="text-xs h-8 gap-1">
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Fields List */}
      <div className="space-y-3">
        {Object.entries(fields).map(([key, field]) => (
          <div key={key} className="p-3 rounded-xl border border-border/60 bg-surface-raised space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                <span>{field.name}</span>
                <span className="text-[10px] text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">
                  {field.type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveField(key)}
                className="text-rose-400 hover:text-rose-500 p-1 rounded"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Label</Label>
                <Input
                  value={field.label || ''}
                  onChange={(e) => handleUpdateField(key, { label: e.target.value })}
                  className="text-xs h-7"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Default Value</Label>
                <Input
                  value={String(field.defaultValue ?? '')}
                  onChange={(e) =>
                    handleUpdateField(key, {
                      defaultValue: field.type === 'number' ? Number(e.target.value) : e.target.value,
                    })
                  }
                  className="text-xs h-7"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={`req-${key}`}
                checked={field.required}
                onCheckedChange={(c) => handleUpdateField(key, { required: Boolean(c) })}
              />
              <label htmlFor={`req-${key}`} className="text-xs text-foreground cursor-pointer select-none">
                Required Field
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
