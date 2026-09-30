import { knowledgeApi } from '@org/api-client';
import { storage } from './storage.js';
import { INITIAL_KNOWLEDGE_BASES } from './mockData.js';

const STORAGE_KEY = 'knowledge_bases_list';

function loadBases() {
  const cached = storage.get(STORAGE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  storage.set(STORAGE_KEY, INITIAL_KNOWLEDGE_BASES);
  return INITIAL_KNOWLEDGE_BASES;
}

export const knowledgeService = {
  async getKnowledgeBases(workspaceId) {
    if (workspaceId) {
      try {
        const live = await knowledgeApi.list(workspaceId);
        if (Array.isArray(live) && live.length > 0) {
          storage.set(STORAGE_KEY, live);
          return live;
        }
      } catch (err) {
        console.warn('Backend knowledgeApi.list failed, falling back to cache:', err);
      }
    }
    return loadBases();
  },

  async createKnowledgeBase(data, workspaceId) {
    if (workspaceId) {
      try {
        const live = await knowledgeApi.create(workspaceId, {
          name: data.name,
          description: data.description,
          embeddingModel: data.embeddingModel || 'text-embedding-3-small',
        });
        if (live) {
          const list = loadBases();
          storage.set(STORAGE_KEY, [live, ...list]);
          return live;
        }
      } catch (err) {
        console.warn('Backend knowledgeApi.create failed, falling back to local creation:', err);
      }
    }

    const list = loadBases();
    const newBase = {
      id: `kb-${Date.now().toString(36)}`,
      name: data.name || 'Untitled Knowledge Base',
      description: data.description || 'Collection of documents for RAG',
      totalDocuments: 0,
      totalChunks: 0,
      embeddingModel: data.embeddingModel || 'text-embedding-3-small',
      vectorStore: 'Qdrant (Hybrid Search)',
      lastIndexed: new Date().toISOString(),
      status: 'READY',
      sources: [],
    };
    list.unshift(newBase);
    storage.set(STORAGE_KEY, list);
    return newBase;
  },

  async deleteKnowledgeBase(id, workspaceId) {
    if (workspaceId) {
      try {
        await knowledgeApi.delete(workspaceId, id);
      } catch (err) {
        console.warn('Backend knowledgeApi.delete failed:', err);
      }
    }
    const list = loadBases();
    const updated = list.filter((b) => b.id !== id);
    storage.set(STORAGE_KEY, updated);
    return { success: true };
  },

  async addSource(knowledgeBaseId, source, workspaceId) {
    if (workspaceId) {
      try {
        const liveDoc = await knowledgeApi.ingestDocument(workspaceId, knowledgeBaseId, {
          name: source.name,
          sourceType: source.type?.toUpperCase() === 'URL' ? 'URL' : 'FILE',
          sourceUri: source.url,
          rawText: source.rawText,
        });
        if (liveDoc) return liveDoc;
      } catch (err) {
        console.warn('Backend knowledgeApi.ingestDocument failed, using local document:', err);
      }
    }

    const list = loadBases();
    const base = list.find((b) => b.id === knowledgeBaseId);
    if (!base) throw new Error('Knowledge base not found');

    const newSource = {
      id: `src-${Date.now().toString(36)}`,
      name: source.name || 'uploaded_document.pdf',
      type: source.type || 'PDF',
      size: source.size || '1.8 MB',
      chunks: Math.floor(Math.random() * 300) + 50,
      status: 'INDEXED',
      createdAt: new Date().toISOString(),
    };

    base.sources = [newSource, ...(base.sources || [])];
    base.totalDocuments = (base.totalDocuments || 0) + 1;
    base.totalChunks = (base.totalChunks || 0) + newSource.chunks;
    base.lastIndexed = new Date().toISOString();

    storage.set(STORAGE_KEY, list);
    return newSource;
  },

  async simulateRetrievalSearch(knowledgeBaseId, query, topK = 3, similarityThreshold = 0.7, workspaceId) {
    if (workspaceId) {
      try {
        const live = await knowledgeApi.testRetrieval(workspaceId, knowledgeBaseId, {
          query,
          topK,
          scoreThreshold: similarityThreshold,
        });
        if (Array.isArray(live) && live.length > 0) return live;
      } catch (err) {
        console.warn('Backend knowledgeApi.testRetrieval failed, using simulated corpus:', err);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 450));

    const mockCorpus = [
      {
        id: 'chunk-1',
        title: 'Single Sign-On (Okta / SAML 2.0) Integration Manual',
        source: 'Product_Handbook_v4.2.pdf',
        score: 0.94,
        snippet:
          'To configure Enterprise SSO, sign in to Okta Admin Console. Create an app integration with SAML 2.0. In the OneTab Security settings, copy the ACS URL and Entity ID into your identity provider.',
      },
      {
        id: 'chunk-2',
        title: 'Billing Invoices and Refund Escalation Policy',
        source: 'Billing_Refund_Guidelines.docx',
        score: 0.88,
        snippet:
          'Tier-1 agents are authorized to issue discretionary billing adjustments up to $50.00. Refunds exceeding $50.00 must route through a Human Approval Checkpoint node to Finance supervisors.',
      },
      {
        id: 'chunk-3',
        title: 'Firecrawl API Architecture and Web Crawling Limits',
        source: 'https://docs.onetab.ai/troubleshooting',
        score: 0.82,
        snippet:
          'Firecrawl allows recursive website scraping into LLM markdown. Set the depth parameter to 2 for blogs and product sites. Rate limits are throttled at 50 requests/sec per workspace.',
      },
      {
        id: 'chunk-4',
        title: 'Multi-Agent Supervisor Routing & Handoff Spec',
        source: 'Kubernetes_Cluster_Spec.pdf',
        score: 0.74,
        snippet:
          'When delegating across coworker boundaries, the router evaluates capability scores and passes the conversation memory thread as an immutable JSON state envelope.',
      },
    ];

    return mockCorpus
      .filter((c) => c.score >= similarityThreshold)
      .slice(0, topK);
  },
};
