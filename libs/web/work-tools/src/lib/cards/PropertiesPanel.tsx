import type {
  CardActionDefinition,
  CardComponentNode,
  CardComponentStyle,
  CardDataSchema,
  CardVisibilityCondition,
} from '@org/types';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import {
  Code,
  Copy,
  Eye,
  Layers,
  Layout,
  Lock,
  MousePointer,
  Paintbrush,
  Sparkles,
  Type,
  Unlock,
} from 'lucide-react';
import React, { useState } from 'react';

export interface PropertiesPanelProps {
  selectedNode: CardComponentNode | null;
  schema?: CardDataSchema;
  actions?: CardActionDefinition[];
  onUpdateNodeProps: (nodeId: string, props: Record<string, unknown>) => void;
  onUpdateNodeStyle: (nodeId: string, style: CardComponentStyle) => void;
  onUpdateNodeVisibility: (nodeId: string, condition?: CardVisibilityCondition) => void;
  onUpdateNodeAction: (nodeId: string, actionId?: string) => void;
  onToggleLockNode: (nodeId: string) => void;
}

export function PropertiesPanel({
  selectedNode,
  schema,
  actions = [],
  onUpdateNodeProps,
  onUpdateNodeStyle,
  onUpdateNodeVisibility,
  onUpdateNodeAction,
  onToggleLockNode,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'props' | 'style' | 'visibility'>('props');

  if (!selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground bg-surface border-l border-border/60">
        <MousePointer className="size-8 mb-2 opacity-40 text-primary" />
        <span className="text-xs font-semibold text-foreground">No component selected</span>
        <p className="text-[11px] mt-1 max-w-[200px]">
          Click any component on the canvas or tree hierarchy to edit its properties, styles, and data bindings.
        </p>
      </div>
    );
  }

  const props = selectedNode.props || {};
  const style = selectedNode.style || {};
  const visibility = selectedNode.visibleWhen || {};

  const handlePropChange = (key: string, value: unknown) => {
    onUpdateNodeProps(selectedNode.id, { ...props, [key]: value });
  };

  const handleStyleChange = (key: keyof CardComponentStyle, value: string) => {
    onUpdateNodeStyle(selectedNode.id, { ...style, [key]: value });
  };

  const handleInsertBinding = (targetProp: string, fieldName: string, filter?: string) => {
    const expr = filter ? `{{${fieldName} | ${filter}}}` : `{{${fieldName}}}`;
    handlePropChange(targetProp, expr);
  };

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border/60 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground capitalize">
              {selectedNode.type}
            </span>
            <Badge variant="outline" className="text-[9px] py-0 font-mono">
              {selectedNode.id}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">Configure attributes &amp; design tokens</span>
        </div>

        <button
          type="button"
          onClick={() => onToggleLockNode(selectedNode.id)}
          title={selectedNode.locked ? 'Unlock Component' : 'Lock Component'}
          className="p-1.5 rounded-lg border border-border/60 hover:bg-accent text-foreground transition-colors"
        >
          {selectedNode.locked ? (
            <Lock className="size-3.5 text-amber-500" />
          ) : (
            <Unlock className="size-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-border/60 bg-surface-raised p-1 gap-1">
          <TabsTrigger value="props" className="text-xs py-1 px-2.5 h-7">
            <Type className="size-3 mr-1" />
            Props
          </TabsTrigger>
          <TabsTrigger value="style" className="text-xs py-1 px-2.5 h-7">
            <Paintbrush className="size-3 mr-1" />
            Styles
          </TabsTrigger>
          <TabsTrigger value="visibility" className="text-xs py-1 px-2.5 h-7">
            <Eye className="size-3 mr-1" />
            Rules
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Component Properties */}
        <TabsContent value="props" className="flex-1 overflow-y-auto p-3 space-y-3 mt-0">
          {/* Typography Controls */}
          {(selectedNode.type === 'text' || selectedNode.type === 'heading' || selectedNode.type === 'paragraph') && (
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold">Content Text</Label>
                  {schema?.fields && Object.keys(schema.fields).length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Bind:</span>
                      {Object.keys(schema.fields).slice(0, 3).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => handleInsertBinding('text', f)}
                          className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-mono hover:bg-primary/20"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  value={String(props['text'] || '')}
                  onChange={(e) => handlePropChange('text', e.target.value)}
                  placeholder="e.g. {{customer.name}}"
                  className="text-xs h-8 font-mono"
                />
              </div>

              {selectedNode.type === 'heading' && (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Heading Level</Label>
                  <Select
                    value={String(props['level'] || 3)}
                    onValueChange={(val) => handlePropChange('level', parseInt(val, 10))}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="1">H1 (Large)</SelectItem>
                      <SelectItem value="2">H2 (Medium)</SelectItem>
                      <SelectItem value="3">H3 (Small)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Button & Action Controls */}
          {selectedNode.type === 'button' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Button Label</Label>
                <Input
                  value={String(props['label'] || '')}
                  onChange={(e) => handlePropChange('label', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Button Variant</Label>
                <Select
                  value={String(props['variant'] || 'primary')}
                  onValueChange={(val) => handlePropChange('variant', val)}
                >
                  <SelectTrigger className="text-xs h-8">
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
              <div>
                <Label className="text-xs font-semibold mb-1 block">Action Trigger</Label>
                <Select
                  value={String(selectedNode.actionId || props['actionId'] || '')}
                  onValueChange={(val) => {
                    handlePropChange('actionId', val);
                    onUpdateNodeAction(selectedNode.id, val);
                  }}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Select an action…" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="none">None (Static)</SelectItem>
                    {actions.map((act) => (
                      <SelectItem key={act.id} value={act.id}>
                        {act.label} ({act.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Badge Controls */}
          {selectedNode.type === 'badge' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Badge Text</Label>
                <Input
                  value={String(props['text'] || '')}
                  onChange={(e) => handlePropChange('text', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Variant</Label>
                <Select
                  value={String(props['variant'] || 'primary')}
                  onValueChange={(val) => handlePropChange('variant', val)}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="destructive">Destructive</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Key Value Controls */}
          {selectedNode.type === 'key_value' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Label</Label>
                <Input
                  value={String(props['label'] || '')}
                  onChange={(e) => handlePropChange('label', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Value Expression</Label>
                <Input
                  value={String(props['value'] || '')}
                  onChange={(e) => handlePropChange('value', e.target.value)}
                  placeholder="e.g. {{price | currency}}"
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>
          )}

          {/* Image Controls */}
          {selectedNode.type === 'image' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Image Source URL</Label>
                <Input
                  value={String(props['src'] || '')}
                  onChange={(e) => handlePropChange('src', e.target.value)}
                  placeholder="https://… or {{imageUrl}}"
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Alt Description</Label>
                <Input
                  value={String(props['alt'] || '')}
                  onChange={(e) => handlePropChange('alt', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
          )}

          {/* Input Controls */}
          {selectedNode.type === 'input' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Field Name</Label>
                <Input
                  value={String(props['name'] || '')}
                  onChange={(e) => handlePropChange('name', e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Label</Label>
                <Input
                  value={String(props['label'] || '')}
                  onChange={(e) => handlePropChange('label', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Placeholder</Label>
                <Input
                  value={String(props['placeholder'] || '')}
                  onChange={(e) => handlePropChange('placeholder', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
          )}

          {/* Alert Controls */}
          {selectedNode.type === 'alert' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Title</Label>
                <Input
                  value={String(props['title'] || '')}
                  onChange={(e) => handlePropChange('title', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Description</Label>
                <Input
                  value={String(props['description'] || '')}
                  onChange={(e) => handlePropChange('description', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Design Tokens & Layout Styles */}
        <TabsContent value="style" className="flex-1 overflow-y-auto p-3 space-y-3 mt-0">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Padding</Label>
            <Input
              value={style.padding || ''}
              onChange={(e) => handleStyleChange('padding', e.target.value)}
              placeholder="e.g. 16px or 8px 12px"
              className="text-xs h-8 font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Margin</Label>
            <Input
              value={style.margin || ''}
              onChange={(e) => handleStyleChange('margin', e.target.value)}
              placeholder="e.g. 0 0 12px 0"
              className="text-xs h-8 font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Gap (Flex/Grid)</Label>
            <Input
              value={style.gap || ''}
              onChange={(e) => handleStyleChange('gap', e.target.value)}
              placeholder="e.g. 8px"
              className="text-xs h-8 font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Border Radius</Label>
            <Input
              value={style.borderRadius || ''}
              onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
              placeholder="e.g. 12px or 16px"
              className="text-xs h-8 font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Background</Label>
            <Select
              value={style.background || 'none'}
              onValueChange={(val) => handleStyleChange('background', val)}
            >
              <SelectTrigger className="text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="none">Transparent</SelectItem>
                <SelectItem value="surface">Surface</SelectItem>
                <SelectItem value="surface-raised">Surface Raised</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* Tab 3: Conditional Visibility Rules */}
        <TabsContent value="visibility" className="flex-1 overflow-y-auto p-3 space-y-3 mt-0">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Show component when field:</Label>
            <Input
              value={visibility.field || ''}
              onChange={(e) =>
                onUpdateNodeVisibility(selectedNode.id, {
                  ...visibility,
                  field: e.target.value,
                })
              }
              placeholder="e.g. status or risk"
              className="text-xs h-8 font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Condition Operator</Label>
            <Select
              value={visibility.operator || 'equals'}
              onValueChange={(val: any) =>
                onUpdateNodeVisibility(selectedNode.id, {
                  ...visibility,
                  operator: val,
                })
              }
            >
              <SelectTrigger className="text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="equals">Equals (==)</SelectItem>
                <SelectItem value="not_equals">Does Not Equal (!=)</SelectItem>
                <SelectItem value="contains">Contains substring</SelectItem>
                <SelectItem value="greater_than">Greater Than (&gt;)</SelectItem>
                <SelectItem value="less_than">Less Than (&lt;)</SelectItem>
                <SelectItem value="exists">Exists / Not Null</SelectItem>
                <SelectItem value="not_empty">Is Not Empty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Target Value</Label>
            <Input
              value={String(visibility.value ?? '')}
              onChange={(e) =>
                onUpdateNodeVisibility(selectedNode.id, {
                  ...visibility,
                  value: e.target.value,
                })
              }
              placeholder="e.g. pending or true"
              className="text-xs h-8"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
