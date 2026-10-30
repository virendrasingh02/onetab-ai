import Ionicons from '@expo/vector-icons/Ionicons';
import {
  agentsApi,
  automationsApi,
  queryKeys,
} from '@org/api-client';
import type { AIAgent } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  IconButton,
  ListRow,
  Screen,
  TextField,
} from '../../../components/ui';
import { statusTone } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

export interface StudioNode {
  id: string;
  type: 'TRIGGER' | 'AGENT' | 'TOOL' | 'CONDITION' | 'TRANSFORM' | 'APPROVAL' | 'END';
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  config: Record<string, any>;
}

export interface StudioEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const NODE_CATALOG: Array<{
  type: StudioNode['type'];
  label: string;
  desc: string;
  icon: string;
  color: string;
}> = [
  { type: 'TRIGGER', label: 'Trigger', desc: 'Manual, schedule (cron), or webhook', icon: 'flash', color: '#10b981' },
  { type: 'AGENT', label: 'AI Agent', desc: 'Run an autonomous agent with prompt', icon: 'sparkles', color: '#6366f1' },
  { type: 'TOOL', label: 'MCP / Tool', desc: 'Call an external integration or tool', icon: 'construct', color: '#f59e0b' },
  { type: 'CONDITION', label: 'Condition', desc: 'Branch execution based on rules', icon: 'git-branch', color: '#ec4899' },
  { type: 'TRANSFORM', label: 'Transform', desc: 'Format, map, or filter data', icon: 'shuffle', color: '#06b6d4' },
  { type: 'APPROVAL', label: 'Approval', desc: 'Pause run for human sign-off', icon: 'shield-checkmark', color: '#ef4444' },
  { type: 'END', label: 'End / Output', desc: 'Finalize run and notify channels', icon: 'checkmark-done', color: '#64748b' },
];

export default function AgentStudioScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workflowId } = useLocalSearchParams<{ workflowId?: string }>();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 720;

  // Canvas State
  const [nodes, setNodes] = useState<StudioNode[]>([]);
  const [edges, setEdges] = useState<StudioEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });

  // Modals & Panels
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);

  // Workflow Metadata
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');

  // 1. Fetch workflow if workflowId is passed
  const workflowQuery = useQuery({
    queryKey: queryKeys.automations.detail(workspaceId, workflowId || ''),
    queryFn: () => automationsApi.get(workspaceId, workflowId!),
    enabled: Boolean(workspaceId && workflowId),
  });

  // 2. Fetch workspace agents for agent nodes
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(workspaceId),
    queryFn: () => agentsApi.list(workspaceId).catch(() => [] as AIAgent[]),
    enabled: Boolean(workspaceId),
  });

  // Load workflow graph into state
  useEffect(() => {
    if (workflowQuery.data) {
      const wf = workflowQuery.data;
      setWorkflowName(wf.name);
      setWorkflowDescription(wf.description || '');

      try {
        const parsedNodes = JSON.parse(wf.nodesJson || '[]');
        if (Array.isArray(parsedNodes) && parsedNodes.length > 0) {
          const mappedNodes: StudioNode[] = parsedNodes.map((n: any, idx: number) => ({
            id: n.id || `node_${idx}`,
            type: (n.type || n.data?.type || 'AGENT').toUpperCase(),
            label: n.data?.label || n.label || `Step ${idx + 1}`,
            subtitle: n.data?.subtitle || n.subtitle,
            x: n.position?.x ?? 50 + (idx % 2) * 160,
            y: n.position?.y ?? 50 + Math.floor(idx / 2) * 140,
            config: n.config || n.data?.config || {},
          }));
          setNodes(mappedNodes);
        } else {
          loadDefaultGraph();
        }
      } catch {
        loadDefaultGraph();
      }

      try {
        const parsedEdges = JSON.parse(wf.edgesJson || '[]');
        if (Array.isArray(parsedEdges)) {
          setEdges(
            parsedEdges.map((e: any, idx: number) => ({
              id: e.id || `edge_${idx}`,
              source: e.source,
              target: e.target,
              label: e.label,
            })),
          );
        }
      } catch {
        setEdges([]);
      }
    } else if (!workflowId) {
      loadDefaultGraph();
    }
  }, [workflowQuery.data, workflowId]);

  const loadDefaultGraph = () => {
    setNodes([
      {
        id: 'node_trigger',
        type: 'TRIGGER',
        label: 'Start Trigger',
        subtitle: 'Manual run',
        x: 60,
        y: 60,
        config: { triggerType: 'MANUAL' },
      },
      {
        id: 'node_agent',
        type: 'AGENT',
        label: 'AI Analyst',
        subtitle: 'Analyze inputs',
        x: 60,
        y: 200,
        config: { prompt: 'Analyze inputs and draft action summary' },
      },
      {
        id: 'node_end',
        type: 'END',
        label: 'Finish',
        subtitle: 'Complete execution',
        x: 60,
        y: 340,
        config: {},
      },
    ]);
    setEdges([
      { id: 'edge_1', source: 'node_trigger', target: 'node_agent' },
      { id: 'edge_2', source: 'node_agent', target: 'node_end' },
    ]);
  };

  // Node Selection
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const handleSelectNode = (node: StudioNode) => {
    haptics.selection();
    if (connectingSourceId) {
      if (connectingSourceId !== node.id) {
        // Create edge
        const newEdge: StudioEdge = {
          id: `edge_${Date.now()}`,
          source: connectingSourceId,
          target: node.id,
        };
        setEdges((prev) => [...prev, newEdge]);
        haptics.success();
      }
      setConnectingSourceId(null);
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    if (!isTablet) {
      setInspectorOpen(true);
    }
  };

  const handleAddNode = (type: StudioNode['type']) => {
    haptics.success();
    const catalogItem = NODE_CATALOG.find((c) => c.type === type);
    const newNode: StudioNode = {
      id: `node_${Date.now()}`,
      type,
      label: catalogItem?.label || 'New Step',
      subtitle: catalogItem?.desc,
      x: Math.round(-pan.x + 120),
      y: Math.round(-pan.y + 120),
      config: {},
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setPaletteOpen(false);
    if (!isTablet) setInspectorOpen(true);
  };

  const handleDeleteNode = (nodeId: string) => {
    haptics.selection();
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setInspectorOpen(false);
    }
  };

  const handleDeleteEdge = (edgeId: string) => {
    haptics.selection();
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    setSelectedEdgeId(null);
  };

  const updateSelectedNode = (updates: Partial<StudioNode>) => {
    if (!selectedNodeId) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === selectedNodeId ? { ...n, ...updates } : n)),
    );
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const nodesPayload = JSON.stringify(
        nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: { x: n.x, y: n.y },
          data: { label: n.label, subtitle: n.subtitle, type: n.type, config: n.config },
          config: n.config,
        })),
      );
      const edgesPayload = JSON.stringify(edges);

      if (workflowId) {
        return automationsApi.update(workspaceId, workflowId, {
          name: workflowName,
          description: workflowDescription,
          nodesJson: nodesPayload,
          edgesJson: edgesPayload,
        });
      } else {
        return automationsApi.create(workspaceId, {
          name: workflowName,
          description: workflowDescription,
          triggerType: nodes.find((n) => n.type === 'TRIGGER')?.config?.triggerType || 'MANUAL',
          nodesJson: nodesPayload,
          edgesJson: edgesPayload,
        });
      }
    },
    onSuccess: (saved) => {
      haptics.success();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(workspaceId),
      });
      Alert.alert('Workflow Saved', 'Graph and steps saved to workspace.');
      if (!workflowId) {
        router.replace({
          pathname: '/automation/studio',
          params: { workflowId: saved.id },
        });
      }
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Save Failed', err.message);
    },
  });

  // Publish Mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) throw new Error('Save the workflow before publishing.');
      return automationsApi.publish(workspaceId, workflowId, 'Published from Mobile Studio');
    },
    onSuccess: () => {
      haptics.success();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(workspaceId),
      });
      Alert.alert('Workflow Published', 'Workflow version activated successfully.');
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Publish Failed', err.message);
    },
  });

  // Test Run Mutation
  const runMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) {
        throw new Error('Save the workflow before running.');
      }
      return automationsApi.trigger(workspaceId, workflowId, { source: 'mobile_studio' });
    },
    onSuccess: (res) => {
      haptics.success();
      setExecutionResult(res);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Execution Error', err.message);
    },
  });

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: workflowName || 'Agent Studio',
          headerRight: () => (
            <View style={styles.headerRight}>
              <IconButton
                icon="play"
                label="Run"
                disabled={!workflowId || runMutation.isPending}
                onPress={() => runMutation.mutate()}
              />
              <IconButton
                icon="cloud-upload-outline"
                label="Publish"
                disabled={!workflowId || publishMutation.isPending}
                onPress={() => publishMutation.mutate()}
              />
              <IconButton
                icon="save-outline"
                label="Save"
                disabled={saveMutation.isPending}
                onPress={() => saveMutation.mutate()}
              />
            </View>
          ),
        }}
      />

      {/* Main Studio Area */}
      <View style={[styles.mainLayout, isTablet && styles.tabletRow]}>
        {/* Visual Workflow Canvas */}
        <View style={[styles.canvasContainer, { backgroundColor: colors.background }]}>
          {/* Canvas Floating Toolbar */}
          <View style={[styles.canvasToolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <IconButton
              icon="add"
              label="Add step"
              onPress={() => setPaletteOpen(true)}
            />
            <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
            <IconButton
              icon={connectingSourceId ? 'close-circle' : 'git-network-outline'}
              label="Connect steps"
              onPress={() => {
                haptics.selection();
                if (connectingSourceId) {
                  setConnectingSourceId(null);
                } else if (selectedNodeId) {
                  setConnectingSourceId(selectedNodeId);
                } else {
                  Alert.alert('Connect Mode', 'Select a starting step first, then tap Connect.');
                }
              }}
            />
            <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
            <IconButton
              icon="remove-outline"
              label="Zoom out"
              onPress={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            />
            <IconButton
              icon="add-outline"
              label="Zoom in"
              onPress={() => setZoom((z) => Math.min(1.4, z + 0.15))}
            />
            <IconButton
              icon="scan-outline"
              label="Reset view"
              onPress={() => {
                setZoom(1);
                setPan({ x: 40, y: 40 });
              }}
            />
          </View>

          {/* Connect Mode Banner */}
          {connectingSourceId ? (
            <View style={[styles.connectBanner, { backgroundColor: colors.accent }]}>
              <Ionicons name="link-outline" size={16} color="#ffffff" />
              <AppText variant="caption" style={{ color: '#ffffff', fontWeight: '600' }}>
                Tap the target step to connect
              </AppText>
            </View>
          ) : null}

          {/* Interactive Interactive Canvas Area */}
          <ScrollView
            horizontal
            style={styles.canvasScroll}
            contentContainerStyle={styles.canvasContent}
          >
            <ScrollView style={styles.canvasVerticalScroll}>
              <View
                style={[
                  styles.canvasPlane,
                  {
                    transform: [
                      { translateX: pan.x },
                      { translateY: pan.y },
                      { scale: zoom },
                    ],
                  },
                ]}
              >
                {/* Render Edges / Connectors */}
                {edges.map((edge) => {
                  const sourceNode = nodes.find((n) => n.id === edge.source);
                  const targetNode = nodes.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isEdgeSelected = selectedEdgeId === edge.id;
                  const dx = targetNode.x - sourceNode.x;
                  const dy = targetNode.y - sourceNode.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                  return (
                    <Pressable
                      key={edge.id}
                      onPress={() => {
                        haptics.selection();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                      style={[
                        styles.edgeLine,
                        {
                          width: length,
                          left: sourceNode.x + 80,
                          top: sourceNode.y + 45,
                          transform: [{ rotate: `${angle}deg` }],
                          backgroundColor: isEdgeSelected ? colors.primaryText : colors.subtle,
                        },
                      ]}
                    />
                  );
                })}

                {/* Render Nodes */}
                {nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isSource = connectingSourceId === node.id;
                  const catalogItem = NODE_CATALOG.find((c) => c.type === node.type);

                  return (
                    <Pressable
                      key={node.id}
                      onPress={() => handleSelectNode(node)}
                      style={[
                        styles.nodeCard,
                        {
                          left: node.x,
                          top: node.y,
                          backgroundColor: colors.card,
                          borderColor: isSelected
                            ? colors.primaryText
                            : isSource
                              ? colors.ring
                              : colors.border,
                          borderWidth: isSelected || isSource ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.nodeHeader}>
                        <View
                          style={[
                            styles.nodeIconWrap,
                            { backgroundColor: catalogItem?.color || colors.primaryText },
                          ]}
                        >
                          <Ionicons
                            name={(catalogItem?.icon as any) || 'sparkles'}
                            size={14}
                            color="#ffffff"
                          />
                        </View>
                        <AppText
                          variant="caption"
                          numberOfLines={1}
                          style={{ fontWeight: '700', flex: 1 }}
                        >
                          {node.label}
                        </AppText>
                        <Badge label={node.type} tone="neutral" />
                      </View>
                      {node.subtitle ? (
                        <AppText
                          variant="caption"
                          numberOfLines={1}
                          style={{ color: colors.subtle, marginTop: 4 }}
                        >
                          {node.subtitle}
                        </AppText>
                      ) : null}

                      {/* Ports */}
                      <View style={[styles.port, styles.portTop, { backgroundColor: colors.subtle }]} />
                      <View style={[styles.port, styles.portBottom, { backgroundColor: colors.subtle }]} />
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        </View>

        {/* Tablet Split Inspector Panel */}
        {isTablet ? (
          <View style={[styles.tabletInspector, { backgroundColor: colors.card, borderLeftColor: colors.border }]}>
            {selectedNode ? (
              <ScrollView style={styles.inspectorScroll}>
                <AppText variant="heading">Step Inspector</AppText>
                <TextField
                  label="Step Name"
                  value={selectedNode.label}
                  onChangeText={(val) => updateSelectedNode({ label: val })}
                />
                <TextField
                  label="Description"
                  value={selectedNode.subtitle || ''}
                  onChangeText={(val) => updateSelectedNode({ subtitle: val })}
                />
                {selectedNode.type === 'AGENT' ? (
                  <View style={{ gap: spacing.xs, marginVertical: spacing.xs }}>
                    <AppText variant="label">Select Agent</AppText>
                    {agentsQuery.data?.slice(0, 5).map((a) => (
                      <Pressable
                        key={a.id}
                        onPress={() => updateSelectedNode({ config: { agentId: a.id, agentName: a.name } })}
                        style={[
                          styles.selectionRow,
                          {
                            backgroundColor: selectedNode.config.agentId === a.id ? colors.selected : colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <AppText variant="body">{a.name}</AppText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Button
                  label="Delete Step"
                  variant="ghost"
                  icon="trash-outline"
                  onPress={() => handleDeleteNode(selectedNode.id)}
                  style={{ marginTop: spacing.md }}
                />
              </ScrollView>
            ) : selectedEdgeId ? (
              <View style={styles.emptyInspector}>
                <AppText variant="label">Connector Selected</AppText>
                <Button
                  label="Delete Connector"
                  variant="destructive"
                  icon="trash-outline"
                  onPress={() => handleDeleteEdge(selectedEdgeId)}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            ) : (
              <View style={styles.emptyInspector}>
                <AppText variant="muted">Select a step or connector to inspect its configuration.</AppText>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Node Palette Sheet */}
      <Modal
        visible={paletteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPaletteOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPaletteOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Add Workflow Step</AppText>
              <IconButton icon="close" label="Close" onPress={() => setPaletteOpen(false)} />
            </View>
            <ScrollView>
              {NODE_CATALOG.map((item) => (
                <ListRow
                  key={item.type}
                  icon={item.icon as any}
                  title={item.label}
                  subtitle={item.desc}
                  onPress={() => handleAddNode(item.type)}
                />
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Mobile Node Configuration Sheet (Phones) */}
      {!isTablet && (
        <Modal
          visible={inspectorOpen && Boolean(selectedNode)}
          transparent
          animationType="slide"
          onRequestClose={() => setInspectorOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setInspectorOpen(false)}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.sheetHeader}>
                <AppText variant="heading">Configure Step</AppText>
                <IconButton icon="close" label="Close" onPress={() => setInspectorOpen(false)} />
              </View>
              {selectedNode ? (
                <ScrollView contentContainerStyle={styles.sheetContent}>
                  <TextField
                    label="Step Label"
                    value={selectedNode.label}
                    onChangeText={(val) => updateSelectedNode({ label: val })}
                  />
                  <TextField
                    label="Description"
                    value={selectedNode.subtitle || ''}
                    onChangeText={(val) => updateSelectedNode({ subtitle: val })}
                  />
                  {selectedNode.type === 'AGENT' ? (
                    <View style={styles.agentSelectBlock}>
                      <AppText variant="label">Assign Agent</AppText>
                      {agentsQuery.data?.slice(0, 4).map((a) => (
                        <Pressable
                          key={a.id}
                          onPress={() =>
                            updateSelectedNode({
                              config: { ...selectedNode.config, agentId: a.id, agentName: a.name },
                            })
                          }
                          style={[
                            styles.selectionRow,
                            {
                              backgroundColor:
                                selectedNode.config.agentId === a.id
                                  ? colors.selected
                                  : colors.background,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <AppText variant="body">{a.name}</AppText>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <Button
                    label="Delete Step"
                    variant="ghost"
                    icon="trash-outline"
                    onPress={() => handleDeleteNode(selectedNode.id)}
                    style={{ marginTop: spacing.md }}
                  />
                </ScrollView>
              ) : null}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Execution Monitor Modal */}
      <Modal
        visible={Boolean(executionResult)}
        transparent
        animationType="slide"
        onRequestClose={() => setExecutionResult(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setExecutionResult(null)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Execution Monitor</AppText>
              <IconButton icon="close" label="Close" onPress={() => setExecutionResult(null)} />
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <View style={styles.execStatusRow}>
                <AppText variant="label">Status:</AppText>
                <Badge
                  label={executionResult?.status || 'RUNNING'}
                  tone={statusTone(executionResult?.status || 'RUNNING')}
                />
              </View>
              <AppText variant="caption" style={{ color: colors.subtle }}>
                Execution ID: {executionResult?.executionId}
              </AppText>

              <SectionHeader title="Step Results" />
              {executionResult?.results?.map((res: any, idx: number) => (
                <View key={idx} style={[styles.resultItem, { backgroundColor: colors.background }]}>
                  <View style={styles.resultItemHeader}>
                    <AppText variant="body" style={{ fontWeight: '600' }}>
                      {res.type || `Step ${idx + 1}`}
                    </AppText>
                    <Badge label={res.status} tone={statusTone(res.status)} />
                  </View>
                  {res.output ? (
                    <AppText variant="caption" style={{ color: colors.subtle, marginTop: 4 }}>
                      {typeof res.output === 'string' ? res.output : JSON.stringify(res.output)}
                    </AppText>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>
      <AppText variant="label">{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mainLayout: {
    flex: 1,
  },
  tabletRow: {
    flexDirection: 'row',
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  canvasToolbar: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4,
  },
  verticalDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  connectBanner: {
    position: 'absolute',
    top: spacing.sm + 48,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  canvasScroll: {
    flex: 1,
  },
  canvasContent: {
    minWidth: 1200,
    minHeight: 1200,
  },
  canvasVerticalScroll: {
    flex: 1,
  },
  canvasPlane: {
    width: 1200,
    height: 1200,
    position: 'relative',
  },
  edgeLine: {
    position: 'absolute',
    height: 2,
    zIndex: 1,
  },
  nodeCard: {
    position: 'absolute',
    width: 170,
    borderRadius: radius.lg,
    padding: spacing.sm,
    zIndex: 2,
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nodeIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  port: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: 'center',
  },
  portTop: {
    top: -4,
  },
  portBottom: {
    bottom: -4,
  },
  tabletInspector: {
    width: 280,
    borderLeftWidth: 1,
    padding: spacing.md,
  },
  inspectorScroll: {
    flex: 1,
  },
  emptyInspector: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  selectionRow: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  agentSelectBlock: {
    gap: spacing.xs,
    marginVertical: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '75%',
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  execStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultItem: {
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  resultItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
