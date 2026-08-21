import {
  UniversalCardRenderer,
  useCardRegistryStore,
} from '@org/chat-ui';
import type {
  CardActionDefinition,
  CardComponentNode,
  CardComponentStyle,
  CardDefinition,
  CardVisibilityCondition,
} from '@org/types';
import { Badge, Button, Input, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowLeft,
  CheckCircle2,
  FolderTree,
  Laptop,
  LayoutGrid,
  Play,
  Save,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionsEditor } from './ActionsEditor.js';
import { ComponentPalette } from './ComponentPalette.js';
import { ComponentTree } from './ComponentTree.js';
import { JsonSourceEditor } from './JsonSourceEditor.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import { SampleDataEditor } from './SampleDataEditor.js';
import { SchemaEditor } from './SchemaEditor.js';
import { type ActionLogEntry, TestConsoleDrawer } from './TestConsoleDrawer.js';

// Tree Helper functions for immutable AST manipulation
function findNodeById(root: CardComponentNode, id: string): CardComponentNode | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

function updateNodeById(
  root: CardComponentNode,
  id: string,
  updater: (node: CardComponentNode) => CardComponentNode,
): CardComponentNode {
  if (root.id === id) {
    return updater(root);
  }
  if (!root.children) return root;
  return {
    ...root,
    children: root.children.map((c) => updateNodeById(c, id, updater)),
  };
}

function deleteNodeById(root: CardComponentNode, id: string): CardComponentNode {
  if (!root.children) return root;
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== id)
      .map((c) => deleteNodeById(c, id)),
  };
}

function insertNodeIntoTarget(
  root: CardComponentNode,
  targetId: string,
  newNode: CardComponentNode,
): CardComponentNode {
  if (root.id === targetId) {
    // If target is container/row/column/grid, append to children
    if (['container', 'row', 'column', 'stack', 'grid', 'button_group'].includes(root.type)) {
      return {
        ...root,
        children: [...(root.children || []), newNode],
      };
    }
  }
  if (!root.children) return root;
  return {
    ...root,
    children: root.children.map((c) => insertNodeIntoTarget(c, targetId, newNode)),
  };
}

function duplicateNodeInTree(root: CardComponentNode, targetId: string): CardComponentNode {
  if (!root.children) return root;
  const newChildren: CardComponentNode[] = [];
  for (const child of root.children) {
    if (child.id === targetId) {
      const clone: CardComponentNode = JSON.parse(JSON.stringify(child));
      clone.id = `${clone.type}-${Math.random().toString(36).slice(2, 6)}`;
      newChildren.push(child);
      newChildren.push(clone);
    } else {
      newChildren.push(duplicateNodeInTree(child, targetId));
    }
  }
  return { ...root, children: newChildren };
}

export function CardBuilderView() {
  const { workspaceSlug, cardId } = useParams<{ workspaceSlug?: string; cardId?: string }>();
  const navigate = useNavigate();

  const store = useCardRegistryStore();
  const existingCard = cardId ? store.getCard(cardId) : undefined;

  // Working state for the card being designed
  const [card, setCard] = useState<CardDefinition>(() => {
    if (existingCard) return JSON.parse(JSON.stringify(existingCard));

    // Default blank starter card
    return {
      cardId: `custom-card-${Math.random().toString(36).slice(2, 6)}`,
      version: 1,
      name: 'Untitled Custom Card',
      description: 'Custom card created with Visual Card Builder.',
      category: 'custom',
      visibility: 'workspace',
      status: 'draft',
      supportedSurfaces: ['matrix', 'agent', 'workflow', 'dashboard', 'inbox'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      schema: {
        fields: {
          title: { name: 'title', label: 'Title', type: 'string', required: true, defaultValue: 'Card Title' },
          subtitle: { name: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: 'Card subtitle text' },
          status: { name: 'status', label: 'Status', type: 'string', defaultValue: 'Active' },
        },
      },
      sampleData: {
        title: 'Q3 Enterprise Architecture Update',
        subtitle: 'Production rollout scheduled for Friday',
        status: 'Active',
      },
      rootComponent: {
        id: 'root',
        type: 'container',
        style: { padding: '16px', borderRadius: '16px', background: 'surface', border: '1px solid border' },
        children: [
          {
            id: 'hdr-row',
            type: 'row',
            style: { justifyContent: 'between', alignItems: 'center', margin: '0 0 10px 0' },
            children: [
              { id: 'h-title', type: 'heading', props: { text: '{{title}}', level: 3 } },
              { id: 'h-badge', type: 'badge', props: { text: '{{status}}', variant: 'primary' } },
            ],
          },
          { id: 'h-sub', type: 'text', props: { text: '{{subtitle}}', size: 'sm', variant: 'muted' }, style: { margin: '0 0 12px 0' } },
          {
            id: 'actions-row',
            type: 'button_group',
            style: { justifyContent: 'end', gap: '8px' },
            children: [
              { id: 'btn-view', type: 'button', props: { label: 'View Details', variant: 'primary', icon: 'Sparkles' } },
            ],
          },
        ],
      },
      actions: [
        { id: 'view_details', type: 'open_url', label: 'View Details', url: 'https://onetab.ai' },
      ],
    };
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [leftTab, setLeftTab] = useState<'palette' | 'tree'>('palette');
  const [rightTab, setRightTab] = useState<'props' | 'schema' | 'sample' | 'actions' | 'json'>('props');
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isTestMode, setIsTestMode] = useState(false);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);

  const selectedNode = useMemo(
    () => findNodeById(card.rootComponent, selectedNodeId),
    [card.rootComponent, selectedNodeId],
  );

  // AST update callbacks
  const handleAddComponent = (newNode: CardComponentNode) => {
    // If selected node is a container-like node, add inside it; otherwise add to root
    const targetId =
      selectedNode && ['container', 'row', 'column', 'stack', 'grid', 'button_group'].includes(selectedNode.type)
        ? selectedNode.id
        : 'root';

    setCard((prev) => ({
      ...prev,
      rootComponent: insertNodeIntoTarget(prev.rootComponent, targetId, newNode),
    }));

    setSelectedNodeId(newNode.id);
    toast.success(`Added ${newNode.type} component`);
  };

  const handleUpdateNodeProps = (nodeId: string, props: Record<string, unknown>) => {
    setCard((prev) => ({
      ...prev,
      rootComponent: updateNodeById(prev.rootComponent, nodeId, (n) => ({ ...n, props })),
    }));
  };

  const handleUpdateNodeStyle = (nodeId: string, style: CardComponentStyle) => {
    setCard((prev) => ({
      ...prev,
      rootComponent: updateNodeById(prev.rootComponent, nodeId, (n) => ({ ...n, style })),
    }));
  };

  const handleUpdateNodeVisibility = (nodeId: string, visibleWhen?: CardVisibilityCondition) => {
    setCard((prev) => ({
      ...prev,
      rootComponent: updateNodeById(prev.rootComponent, nodeId, (n) => ({ ...n, visibleWhen })),
    }));
  };

  const handleUpdateNodeAction = (nodeId: string, actionId?: string) => {
    setCard((prev) => ({
      ...prev,
      rootComponent: updateNodeById(prev.rootComponent, nodeId, (n) => ({ ...n, actionId })),
    }));
  };

  const handleToggleLockNode = (nodeId: string) => {
    setCard((prev) => ({
      ...prev,
      rootComponent: updateNodeById(prev.rootComponent, nodeId, (n) => ({ ...n, locked: !n.locked })),
    }));
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'root') {
      toast.error('Cannot delete root container.');
      return;
    }
    setCard((prev) => ({
      ...prev,
      rootComponent: deleteNodeById(prev.rootComponent, nodeId),
    }));
    setSelectedNodeId('root');
  };

  const handleDuplicateNode = (nodeId: string) => {
    setCard((prev) => ({
      ...prev,
      rootComponent: duplicateNodeInTree(prev.rootComponent, nodeId),
    }));
    toast.success('Component duplicated.');
  };

  // Test Mode Action Execution Listener
  const handleTestAction = async (action: CardActionDefinition, currentData: Record<string, unknown>) => {
    const entry: ActionLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      actionId: action.id,
      actionType: action.type,
      payload: currentData,
      success: true,
      message: action.requiresConfirmation ? 'Action confirmed by user' : undefined,
    };
    setActionLogs((prev) => [entry, ...prev]);
  };

  // Save & Publish
  const handleSaveDraft = () => {
    store.registerCard({ ...card, status: 'draft', updatedAt: Date.now() });
    toast.success(`Draft saved for "${card.name}"`);
  };

  const handlePublish = () => {
    const published = store.publishVersion(card.cardId) || { ...card, status: 'published' as const };
    setCard(published);
    toast.success(`Published "${published.name}" (v${published.version})`);
  };

  // Breakpoint width mapping
  const canvasWidth =
    breakpoint === 'mobile' ? 'max-w-[360px]' : breakpoint === 'tablet' ? 'max-w-[500px]' : 'max-w-[640px]';

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      {/* --- TOP BAR --- */}
      <header className="h-13 border-b border-border/80 bg-surface px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(workspaceSlug ? `/w/${workspaceSlug}/cards` : '/cards')}
            className="h-8 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>Cards</span>
          </Button>

          <div className="h-4 w-px bg-border/60" />

          {/* Inline Editable Card Title */}
          <div className="flex items-center gap-2">
            <Input
              value={card.name}
              onChange={(e) => setCard((prev) => ({ ...prev, name: e.target.value }))}
              className="h-8 text-xs font-bold w-48 sm:w-64 bg-transparent border-transparent hover:border-border focus:border-primary px-2"
            />
            <Badge variant="outline" className="text-[10px] font-mono py-0 h-5">
              v{card.version} · <span className="capitalize">{card.status}</span>
            </Badge>
          </div>
        </div>

        {/* Center: Breakpoints & Theme Controls */}
        <div className="hidden md:flex items-center gap-1 bg-surface-raised p-1 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setBreakpoint('desktop')}
            title="Desktop Breakpoint"
            className={cn(
              'p-1.5 rounded transition-colors',
              breakpoint === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Laptop className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setBreakpoint('tablet')}
            title="Tablet Breakpoint"
            className={cn(
              'p-1.5 rounded transition-colors',
              breakpoint === 'tablet' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Tablet className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setBreakpoint('mobile')}
            title="Mobile Breakpoint"
            className={cn(
              'p-1.5 rounded transition-colors',
              breakpoint === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Smartphone className="size-3.5" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isTestMode ? 'primary' : 'outline'}
            onClick={() => setIsTestMode(!isTestMode)}
            className="h-8 text-xs gap-1.5"
          >
            <Play className="size-3.5" />
            <span>{isTestMode ? 'Exit Test' : 'Test Card'}</span>
          </Button>

          <Button size="sm" variant="outline" onClick={handleSaveDraft} className="h-8 text-xs gap-1.5">
            <Save className="size-3.5" />
            <span>Save Draft</span>
          </Button>

          <Button size="sm" onClick={handlePublish} className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground">
            <CheckCircle2 className="size-3.5" />
            <span>Publish v{card.version + 1}</span>
          </Button>
        </div>
      </header>

      {/* --- MAIN 3-COLUMN WORKSPACE --- */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: Component Catalog or Component Tree */}
        <div className="w-64 border-r border-border/60 bg-surface flex flex-col shrink-0">
          <div className="flex border-b border-border/60 bg-surface-raised p-1 gap-1">
            <button
              type="button"
              onClick={() => setLeftTab('palette')}
              className={cn(
                'flex-1 py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors',
                leftTab === 'palette' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="size-3" />
              Palette
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('tree')}
              className={cn(
                'flex-1 py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors',
                leftTab === 'tree' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <FolderTree className="size-3" />
              Hierarchy
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {leftTab === 'palette' ? (
              <ComponentPalette onAddComponent={handleAddComponent} />
            ) : (
              <ComponentTree
                rootNode={card.rootComponent}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onDeleteNode={handleDeleteNode}
                onDuplicateNode={handleDuplicateNode}
                onToggleLockNode={handleToggleLockNode}
              />
            )}
          </div>
        </div>

        {/* CENTER: LIVE CANVAS */}
        <div className="flex-1 bg-surface-inset flex flex-col overflow-hidden relative">
          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-center">
            {/* Canvas Frame Container */}
            <div className={cn('w-full transition-all duration-300', canvasWidth)}>
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">
                  {breakpoint} Preview ({breakpoint === 'mobile' ? '360px' : breakpoint === 'tablet' ? '500px' : '640px'})
                </span>
                {isTestMode && (
                  <Badge variant="primary" className="text-[9px] py-0">
                    Test Mode Active
                  </Badge>
                )}
              </div>

              {/* Render Universal Card */}
              <div className="border border-border/80 rounded-2xl bg-surface/80 backdrop-blur-sm shadow-md p-1">
                <UniversalCardRenderer
                  cardDefinition={card}
                  data={card.sampleData}
                  isInteractive={isTestMode}
                  onAction={handleTestAction}
                  onFieldChange={(key, val) => {
                    setCard((prev) => ({
                      ...prev,
                      sampleData: { ...(prev.sampleData || {}), [key]: val },
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Test Console Drawer (Visible when Test Mode is Active) */}
          {isTestMode && (
            <TestConsoleDrawer logs={actionLogs} onClearLogs={() => setActionLogs([])} />
          )}
        </div>

        {/* RIGHT PANEL: Inspector (Props, Schema, Sample Data, Actions, JSON) */}
        <div className="w-80 border-l border-border/60 bg-surface flex flex-col shrink-0">
          <div className="flex border-b border-border/60 bg-surface-raised p-1 gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setRightTab('props')}
              className={cn(
                'px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0',
                rightTab === 'props' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Props
            </button>
            <button
              type="button"
              onClick={() => setRightTab('schema')}
              className={cn(
                'px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0',
                rightTab === 'schema' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Schema
            </button>
            <button
              type="button"
              onClick={() => setRightTab('sample')}
              className={cn(
                'px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0',
                rightTab === 'sample' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Data
            </button>
            <button
              type="button"
              onClick={() => setRightTab('actions')}
              className={cn(
                'px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0',
                rightTab === 'actions' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Actions
            </button>
            <button
              type="button"
              onClick={() => setRightTab('json')}
              className={cn(
                'px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0',
                rightTab === 'json' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              JSON
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'props' && (
              <PropertiesPanel
                selectedNode={selectedNode}
                schema={card.schema}
                actions={card.actions}
                onUpdateNodeProps={handleUpdateNodeProps}
                onUpdateNodeStyle={handleUpdateNodeStyle}
                onUpdateNodeVisibility={handleUpdateNodeVisibility}
                onUpdateNodeAction={handleUpdateNodeAction}
                onToggleLockNode={handleToggleLockNode}
              />
            )}

            {rightTab === 'schema' && (
              <SchemaEditor
                schema={card.schema}
                onChange={(newSchema) => setCard((prev) => ({ ...prev, schema: newSchema }))}
              />
            )}

            {rightTab === 'sample' && (
              <SampleDataEditor
                sampleData={card.sampleData || {}}
                onChange={(newData) => setCard((prev) => ({ ...prev, sampleData: newData }))}
              />
            )}

            {rightTab === 'actions' && (
              <ActionsEditor
                actions={card.actions || []}
                onChange={(newActions) => setCard((prev) => ({ ...prev, actions: newActions }))}
              />
            )}

            {rightTab === 'json' && (
              <JsonSourceEditor
                card={card}
                onChange={(updatedCard) => setCard(updatedCard)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
