import { createHash } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface VectorPoint {
  /** Stable string key, e.g. `${documentId}:chunk:3`. Hashed to a UUID before
   *  it reaches Qdrant, which only accepts unsigned-int or UUID point ids. */
  key: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
}

/**
 * Thin, tenant-agnostic wrapper over a Qdrant instance.
 *
 * Every read is narrowed to one workspace by the caller passing `workspaceId`
 * into {@link search} — the filter is applied server-side, so a query can never
 * see another tenant's vectors. Collections are created on first write with the
 * dimensionality of whatever embedding model produced the first vector, so the
 * store follows the configured embedding provider (OpenAI 1536, Cohere 1024,
 * Ollama `nomic-embed-text` 768, …) without a config knob.
 *
 * When `QDRANT_URL` is unset this service is deliberately inert and every
 * method throws {@link ServiceUnavailableException}: RAG that silently returns
 * nothing is indistinguishable from RAG that found nothing, and the audit
 * (§B7) calls that out as worse than an error.
 */
@Injectable()
export class QdrantVectorService implements OnModuleInit {
  private readonly logger = new Logger(QdrantVectorService.name);
  private readonly url?: string;
  private readonly apiKey?: string;
  private client?: QdrantClient;
  /** Collections we have already ensured this process — avoids a round-trip per upsert. */
  private readonly ensured = new Set<string>();

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('QDRANT_URL')?.trim() || undefined;
    this.apiKey = this.config.get<string>('QDRANT_API_KEY')?.trim() || undefined;
  }

  onModuleInit(): void {
    this.logger.log(
      this.url
        ? `Qdrant vector store enabled at ${this.url}`
        : 'Qdrant vector store disabled (QDRANT_URL not set) — RAG endpoints will fail loudly.',
    );
  }

  isConfigured(): boolean {
    return Boolean(this.url);
  }

  private getClient(): QdrantClient {
    if (!this.url) {
      throw new ServiceUnavailableException(
        'Vector store is not configured. Set QDRANT_URL to enable RAG.',
      );
    }
    if (!this.client) {
      this.client = new QdrantClient({
        url: this.url,
        ...(this.apiKey ? { apiKey: this.apiKey } : {}),
        checkCompatibility: false,
      });
    }
    return this.client;
  }

  /**
   * Qdrant point ids must be an unsigned int or a UUID. Chunk keys are neither,
   * so derive a deterministic UUID from the key: the same chunk always maps to
   * the same id, which makes re-ingest an idempotent overwrite.
   */
  private pointId(key: string): string {
    const h = createHash('sha256').update(key).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
      16,
      20,
    )}-${h.slice(20, 32)}`;
  }

  private async ensureCollection(
    collection: string,
    vectorSize: number,
  ): Promise<void> {
    if (this.ensured.has(collection)) return;
    const client = this.getClient();

    try {
      const { exists } = await client.collectionExists(collection);
      if (!exists) {
        await client.createCollection(collection, {
          vectors: { size: vectorSize, distance: 'Cosine' },
        });
        this.logger.log(
          `Created Qdrant collection '${collection}' (dim ${vectorSize}, cosine).`,
        );
      }
      // Payload indexes make the tenant/document filters O(log n) instead of a scan.
      // Both calls are idempotent server-side.
      await client
        .createPayloadIndex(collection, {
          field_name: 'workspaceId',
          field_schema: 'keyword',
        })
        .catch(() => undefined);
      await client
        .createPayloadIndex(collection, {
          field_name: 'documentId',
          field_schema: 'keyword',
        })
        .catch(() => undefined);

      this.ensured.add(collection);
    } catch (err) {
      throw this.wrap(err, `ensuring collection '${collection}'`);
    }
  }

  async upsert(collection: string, points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;
    const vectorSize = points[0]!.vector.length;
    if (vectorSize === 0) {
      throw new ServiceUnavailableException(
        'Refusing to upsert a zero-length vector into the store.',
      );
    }
    await this.ensureCollection(collection, vectorSize);

    try {
      await this.getClient().upsert(collection, {
        wait: true,
        points: points.map((p) => ({
          id: this.pointId(p.key),
          vector: p.vector,
          payload: p.payload,
        })),
      });
    } catch (err) {
      throw this.wrap(err, `upserting ${points.length} vector(s)`);
    }
  }

  async search(
    collection: string,
    vector: number[],
    workspaceId: string,
    limit = 10,
  ): Promise<VectorSearchHit[]> {
    if (!this.ensured.has(collection)) {
      // A search before anything was ever ingested for this collection: no
      // collection yet, so nothing to find. That is a legitimate empty result,
      // not a failure.
      const { exists } = await this.getClient()
        .collectionExists(collection)
        .catch(() => ({ exists: false }));
      if (!exists) return [];
    }

    try {
      const res = await this.getClient().query(collection, {
        query: vector,
        limit,
        with_payload: true,
        filter: {
          must: [{ key: 'workspaceId', match: { value: workspaceId } }],
        },
      });
      return res.points.map((hit) => ({
        id: String(hit.id),
        score: hit.score,
        payload: (hit.payload ?? undefined) as
          | Record<string, unknown>
          | undefined,
      }));
    } catch (err) {
      throw this.wrap(err, 'searching vectors');
    }
  }

  /** Removes every chunk belonging to one document — used before a re-ingest so
   *  a shorter revision does not leave orphan tail chunks behind. */
  async deleteByDocument(
    collection: string,
    documentId: string,
  ): Promise<void> {
    if (!this.url) return;
    try {
      const { exists } = await this.getClient().collectionExists(collection);
      if (!exists) return;
      await this.getClient().delete(collection, {
        wait: true,
        filter: {
          must: [{ key: 'documentId', match: { value: documentId } }],
        },
      });
    } catch (err) {
      throw this.wrap(err, `deleting vectors for document ${documentId}`);
    }
  }

  private wrap(err: unknown, action: string): Error {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Qdrant error while ${action}: ${message}`);
    return new ServiceUnavailableException(
      `Vector store unavailable while ${action}: ${message}`,
    );
  }
}
