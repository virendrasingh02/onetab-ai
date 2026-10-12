import { agentsApi, knowledgeApi } from '@org/api-client';
import type {
  CreateKnowledgeBaseInput,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeRetrievalMode,
  KnowledgeRetrievalResult,
} from '@org/types';

/**
 * Knowledge bases, straight from the platform API. Nothing is cached or
 * invented locally: a failed call throws, and a search returns only what the
 * workspace's own indexed documents matched.
 */

/** Largest file read into the browser to index. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'yaml', 'yml', 'log']);

export type NewSource =
  | { kind: 'text'; name: string; text: string }
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** The text of an uploaded file, or an error that says what can be indexed. */
async function readFileText(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Split it or paste the relevant text.`);
  }
  const isText = file.type.startsWith('text/') || TEXT_EXTENSIONS.has(extensionOf(file.name));
  if (!isText) {
    throw new Error(
      `${file.name} can’t be indexed yet: only text files (.txt, .md, .csv, .json, .html) are read. Export it as text, or paste the content as a note.`,
    );
  }
  return file.text();
}

/** A web page as markdown, using the platform's scraper. */
async function scrapeUrl(workspaceId: string, url: string): Promise<{ title: string; markdown: string }> {
  const res = await agentsApi.testMcpTool(workspaceId, 'firecrawl_scrape', { url });
  const data = res?.data as { title?: string; markdown?: string } | undefined;
  if (!res?.success || !data?.markdown) {
    throw new Error(typeof res?.error === 'string' ? res.error : `Couldn’t read ${url}.`);
  }
  return { title: data.title || url, markdown: data.markdown };
}

export const knowledgeService = {
  getKnowledgeBases(workspaceId: string): Promise<KnowledgeBase[]> {
    return knowledgeApi.list(workspaceId);
  },

  createKnowledgeBase(workspaceId: string, data: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return knowledgeApi.create(workspaceId, {
      name: data.name,
      description: data.description,
      embeddingModel: data.embeddingModel,
    });
  },

  async deleteKnowledgeBase(workspaceId: string, id: string): Promise<void> {
    await knowledgeApi.delete(workspaceId, id);
  },

  getDocuments(workspaceId: string, knowledgeBaseId: string): Promise<KnowledgeDocument[]> {
    return knowledgeApi.listDocuments(workspaceId, knowledgeBaseId);
  },

  async deleteDocument(workspaceId: string, knowledgeBaseId: string, documentId: string): Promise<void> {
    await knowledgeApi.deleteDocument(workspaceId, knowledgeBaseId, documentId);
  },

  /** Reads the source, then has the platform chunk, embed and index it. */
  async addSource(workspaceId: string, knowledgeBaseId: string, source: NewSource): Promise<KnowledgeDocument> {
    if (source.kind === 'text') {
      if (!source.text.trim()) throw new Error('Write or paste some text to index.');
      return knowledgeApi.ingestDocument(workspaceId, knowledgeBaseId, {
        name: source.name.trim() || 'Note',
        sourceType: 'MANUAL',
        rawText: source.text,
        mimeType: 'text/markdown',
      });
    }

    if (source.kind === 'url') {
      const url = source.url.trim();
      const { title, markdown } = await scrapeUrl(workspaceId, url);
      return knowledgeApi.ingestDocument(workspaceId, knowledgeBaseId, {
        name: title,
        sourceType: 'URL',
        sourceUri: url,
        rawText: markdown,
        mimeType: 'text/markdown',
      });
    }

    const text = await readFileText(source.file);
    if (!text.trim()) throw new Error(`${source.file.name} is empty.`);
    return knowledgeApi.ingestDocument(workspaceId, knowledgeBaseId, {
      name: source.file.name,
      sourceType: 'FILE',
      rawText: text,
      mimeType: source.file.type || 'text/plain',
    });
  },

  search(
    workspaceId: string,
    knowledgeBaseId: string,
    query: string,
    options: { topK?: number; scoreThreshold?: number; mode?: KnowledgeRetrievalMode } = {},
  ): Promise<KnowledgeRetrievalResult[]> {
    return knowledgeApi.testRetrieval(workspaceId, knowledgeBaseId, {
      query,
      topK: options.topK,
      scoreThreshold: options.scoreThreshold,
      mode: options.mode,
    });
  },
};
