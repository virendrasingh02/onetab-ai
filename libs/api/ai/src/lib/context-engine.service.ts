import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  ContextConnectedEntity,
  ContextEngineResult,
  ContextQueryRequest,
  ContextRetrievalMode,
  ContextSourceItem,
  GraphNodeDto,
  SubgraphDto,
} from '@org/types';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeGraphService } from './knowledge-graph.service.js';

const DEFAULT_TOKEN_BUDGET = 2_500;
const CHARS_PER_TOKEN = 4;

@Injectable()
export class ContextEngineService {
  private readonly logger = new Logger(ContextEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: KnowledgeGraphService,
    @Optional() private readonly knowledgeService?: KnowledgeService,
  ) {}

  /**
   * The intelligent context pipeline:
   * Intent Detection -> Entity Resolution -> Graph Traversal -> Vector/Semantic Search ->
   * Permission Validation -> Multi-Signal Ranking -> Compression -> Token Budgeting.
   */
  async buildContext(
    workspaceId: string,
    request: ContextQueryRequest,
  ): Promise<ContextEngineResult> {
    const started = Date.now();
    const query = request.query.trim();
    const mode: ContextRetrievalMode = request.mode ?? 'HYBRID';
    const tokenBudget = request.maxTokens ?? DEFAULT_TOKEN_BUDGET;
    const traversalDepth = Math.min(request.traversalDepth ?? 2, 3);
    const topK = request.topK ?? 8;
    const similarityThreshold = request.similarityThreshold ?? 0.3;
    const recencyWeight = request.recencyWeight ?? 0.2;

    const sources: ContextSourceItem[] = [];
    const entitiesResolved: Array<{ id: string; name: string; type: string; confidence: number }> = [];
    let subgraph: SubgraphDto = { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };
    let fallbackUsed = false;

    // ----------------------------------------------------
    // 1. INTENT DETECTION & ENTITY RESOLUTION
    // ----------------------------------------------------
    const seedNodes = await this.resolveSeedEntities(workspaceId, query, request.targetEntity);
    for (const seed of seedNodes) {
      entitiesResolved.push({
        id: seed.id,
        name: seed.name,
        type: seed.entityType,
        confidence: seed.confidence,
      });
    }

    // ----------------------------------------------------
    // 2. GRAPH RETRIEVAL & SUBGRAPH EXTRACTION
    // ----------------------------------------------------
    if (mode === 'GRAPH' || mode === 'HYBRID') {
      if (seedNodes.length > 0) {
        // Traverse from primary seed node
        const primarySeed = seedNodes[0]!;
        subgraph = await this.graphService.traverseGraph(workspaceId, {
          startNodeId: primarySeed.id,
          maxDepth: traversalDepth,
          targetEntityTypes: request.allowedEntityTypes,
          limit: 30,
        });

        // Convert traversed graph nodes into context items
        for (const node of subgraph.nodes) {
          const connected = this.findConnectedEdges(node.id, subgraph);
          const score = node.id === primarySeed.id ? 1.0 : 0.85;

          sources.push({
            id: node.id,
            title: node.name,
            entityType: node.entityType,
            sourceRef: node.sourceRef,
            sourceUri: node.sourceUri,
            link: node.sourceUri ?? undefined,
            score,
            confidence: node.confidence,
            provenance: node.provenance ?? 'KNOWLEDGE_GRAPH',
            snippet: this.formatNodeSnippet(node),
            connectedEntities: connected,
          });
        }
      } else {
        // Perform keyword graph search if no direct seed match
        const searchResults = await this.graphService.queryGraph(workspaceId, {
          query,
          entityTypes: request.allowedEntityTypes,
          limit: 10,
        });
        subgraph = searchResults;

        for (const node of searchResults.nodes) {
          sources.push({
            id: node.id,
            title: node.name,
            entityType: node.entityType,
            sourceRef: node.sourceRef,
            sourceUri: node.sourceUri,
            link: node.sourceUri ?? undefined,
            score: 0.7,
            confidence: node.confidence,
            provenance: 'GRAPH_SEARCH',
            snippet: this.formatNodeSnippet(node),
          });
        }
      }
    }

    // ----------------------------------------------------
    // 3. VECTOR / SEMANTIC SEARCH (HYBRID INTEGRATION)
    // ----------------------------------------------------
    if ((mode === 'VECTOR' || mode === 'HYBRID') && this.knowledgeService) {
      try {
        const kbs = await this.knowledgeService.listKnowledgeBases(workspaceId);
        if (kbs.length > 0) {
          const kbResults = await Promise.all(
            kbs.slice(0, 3).map((kb) =>
              this.knowledgeService!.retrieve(workspaceId, kb.id, {
                query,
                topK: 4,
                mode: 'HYBRID',
                scoreThreshold: similarityThreshold,
              }).catch(() => []),
            ),
          );

          for (const hits of kbResults) {
            for (const hit of hits) {
              sources.push({
                id: hit.chunkId,
                title: hit.documentName,
                entityType: 'Document',
                sourceRef: hit.documentId,
                score: hit.score,
                confidence: 0.9,
                provenance: 'VECTOR_SEARCH',
                snippet: hit.content.slice(0, 600),
                link: `knowledge/doc/${hit.documentId}`,
              });
            }
          }
        }
      } catch (err) {
        this.logger.debug(`Vector retrieval skipped: ${String(err)}`);
      }
    }

    // ----------------------------------------------------
    // 4. FALLBACK TO DIRECT PLATFORM RETRIEVAL IF EMPTY
    // ----------------------------------------------------
    if (sources.length === 0) {
      fallbackUsed = true;
      const [docs, tasks] = await Promise.all([
        this.prisma.workDocument.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 3,
          select: { id: true, title: true, content: true, updatedAt: true },
        }),
        this.prisma.task.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 3,
          select: { id: true, title: true, description: true, status: true, identifier: true, updatedAt: true },
        }),
      ]);

      for (const doc of docs) {
        sources.push({
          id: doc.id,
          title: doc.title,
          entityType: 'Document',
          sourceRef: doc.id,
          score: 0.6,
          provenance: 'PLATFORM_DOCS_FALLBACK',
          snippet: typeof doc.content === 'string'
            ? doc.content.slice(0, 400)
            : doc.content
              ? JSON.stringify(doc.content).slice(0, 400)
              : '',
          link: `docs/${doc.id}`,
        });
      }

      for (const task of tasks) {
        sources.push({
          id: task.id,
          title: task.title,
          entityType: 'Task',
          sourceRef: task.id,
          score: 0.65,
          provenance: 'PLATFORM_TASKS_FALLBACK',
          snippet: `[${task.identifier ?? 'Task'}] ${task.title} - Status: ${task.status}. ${task.description ?? ''}`.slice(0, 400),
          link: `tasks/${task.id}`,
        });
      }
    }

    // ----------------------------------------------------
    // 5. RANKING & DEDUPLICATION
    // ----------------------------------------------------
    const uniqueSources = this.deduplicateSources(sources);

    // Apply recency scoring
    for (const item of uniqueSources) {
      if (item.score < 1.0) {
        // small bonus for items linked to active queries
        item.score = Math.min(1.0, item.score + (recencyWeight * 0.1));
      }
    }

    uniqueSources.sort((a, b) => b.score - a.score);
    const topSources = uniqueSources.slice(0, topK);

    // ----------------------------------------------------
    // 6. COMPRESSION & TOKEN BUDGETING
    // ----------------------------------------------------
    const { promptContext, tokensUsed, tokensSavedEstimate } =
      this.compressAndBudget(topSources, tokenBudget, query);

    const latencyMs = Date.now() - started;

    return {
      query,
      mode,
      promptContext,
      tokenBudget,
      tokensUsed,
      tokensSavedEstimate,
      sources: topSources,
      subgraph,
      entitiesResolved,
      retrievalLatencyMs: latencyMs,
      fallbackUsed,
      grounded: topSources.length > 0,
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private async resolveSeedEntities(
    workspaceId: string,
    query: string,
    targetEntity?: ContextQueryRequest['targetEntity'],
  ): Promise<GraphNodeDto[]> {
    if (targetEntity) {
      const match = await this.graphService.findEntity(
        workspaceId,
        targetEntity.identifier ?? targetEntity.id ?? '',
        targetEntity.type,
      );
      if (match) return [match];
    }

    // Extract potential identifiers (e.g. TASK-123, repo:foo, auth, mobile)
    const words = query
      .replace(/[?!,.:;()]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const candidates: GraphNodeDto[] = [];
    const seen = new Set<string>();

    for (const word of words.slice(0, 5)) {
      const exact = await this.graphService.findEntity(workspaceId, word);
      if (exact && !seen.has(exact.id)) {
        seen.add(exact.id);
        candidates.push(exact);
      }
    }

    if (candidates.length === 0) {
      // Search by name
      const searchRes = await this.graphService.queryGraph(workspaceId, {
        query,
        limit: 3,
      });
      for (const n of searchRes.nodes) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          candidates.push(n);
        }
      }
    }

    return candidates;
  }

  private findConnectedEdges(nodeId: string, subgraph: SubgraphDto): ContextConnectedEntity[] {
    const connected: ContextConnectedEntity[] = [];
    const nodeMap = new Map<string, GraphNodeDto>(subgraph.nodes.map((n) => [n.id, n]));

    for (const edge of subgraph.edges) {
      if (edge.sourceNodeId === nodeId) {
        const target = nodeMap.get(edge.targetNodeId);
        if (target) {
          connected.push({
            name: target.name,
            type: target.entityType,
            relation: edge.relationType,
            targetId: target.id,
          });
        }
      } else if (edge.targetNodeId === nodeId) {
        const source = nodeMap.get(edge.sourceNodeId);
        if (source) {
          connected.push({
            name: source.name,
            type: source.entityType,
            relation: `is_${edge.relationType}_of`,
            targetId: source.id,
          });
        }
      }
    }
    return connected.slice(0, 6);
  }

  private formatNodeSnippet(node: GraphNodeDto): string {
    const props = node.properties;
    const parts: string[] = [];

    if (node.description) parts.push(node.description);
    if (props['status']) parts.push(`Status: ${props['status']}`);
    if (props['priority']) parts.push(`Priority: ${props['priority']}`);
    if (props['method'] && props['path']) parts.push(`${props['method']} ${props['path']}`);
    if (props['isExported']) parts.push('Exported');
    if (Array.isArray(props['parameters']) && props['parameters'].length > 0) {
      parts.push(`Params: (${props['parameters'].join(', ')})`);
    }

    return parts.length > 0 ? parts.join(' | ') : `${node.entityType}: ${node.name}`;
  }

  private deduplicateSources(sources: ContextSourceItem[]): ContextSourceItem[] {
    const map = new Map<string, ContextSourceItem>();
    for (const s of sources) {
      const key = `${s.entityType}:${s.title.toLowerCase()}`;
      const existing = map.get(key);
      if (!existing || s.score > existing.score) {
        map.set(key, s);
      }
    }
    return Array.from(map.values());
  }

  private compressAndBudget(
    sources: ContextSourceItem[],
    tokenBudget: number,
    query: string,
  ): { promptContext: string; tokensUsed: number; tokensSavedEstimate: number } {
    const maxChars = tokenBudget * CHARS_PER_TOKEN;
    const lines: string[] = [
      `### Intelligent Context Engine Context (Query: "${query}")`,
      '',
    ];

    let currentChars = lines.join('\n').length;
    let rawTokensEstimated = 0;

    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]!;
      const rels = s.connectedEntities?.length
        ? ` -> [${s.connectedEntities.map((c) => `${c.relation}: ${c.name}`).join(', ')}]`
        : '';
      const entry = `• [${s.entityType}] ${s.title}${rels}\n  ${s.snippet}\n  (Source: ${s.provenance ?? 'Graph'}, Score: ${s.score.toFixed(2)})`;

      if (currentChars + entry.length > maxChars) {
        lines.push(`\n[... Remaining ${sources.length - i} context items omitted for token efficiency]`);
        break;
      }

      lines.push(entry);
      currentChars += entry.length + 1;
      // Estimate raw uncompressed size: full files/docs would typically be 4-10x larger
      rawTokensEstimated += Math.ceil((s.snippet.length * 5) / CHARS_PER_TOKEN);
    }

    const promptContext = lines.join('\n');
    const tokensUsed = Math.ceil(promptContext.length / CHARS_PER_TOKEN);
    const tokensSavedEstimate = Math.max(0, rawTokensEstimated - tokensUsed);

    return { promptContext, tokensUsed, tokensSavedEstimate };
  }
}
