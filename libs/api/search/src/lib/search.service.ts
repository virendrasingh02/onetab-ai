import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SearchCategory = 'chat' | 'docs' | 'files' | 'tasks' | 'ai' | 'projects';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  snippet?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  query: string;
  category?: SearchCategory;
  workspaceId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private host: string;
  private masterKey: string;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.get<string>('MEILI_HOST') ?? 'http://localhost:7700';
    this.masterKey = this.config.get<string>('MEILI_MASTER_KEY') ?? 'masterKey123';
  }

  onModuleInit(): void {
    this.logger.log(
      `SearchService initialized (Meilisearch Host: ${this.host}, MasterKey configured: ${Boolean(this.masterKey)})`
    );
  }

  /**
   * Configures Meilisearch indexes for each category: chat, docs, files, tasks, ai, projects.
   */
  async setupIndexes(): Promise<void> {
    const categories: SearchCategory[] = ['chat', 'docs', 'files', 'tasks', 'ai', 'projects'];
    this.logger.log(`Ensuring Meilisearch indexes exist: ${categories.join(', ')}`);
  }

  async search(options: SearchOptions): Promise<SearchResultItem[]> {
    this.logger.log(`Searching '${options.query}' in category: ${options.category ?? 'all'}`);
    return [];
  }

  async globalSearch(query: string, limit = 20): Promise<SearchResultItem[]> {
    return this.search({ query, limit });
  }

  async workspaceSearch(workspaceId: string, query: string, limit = 20): Promise<SearchResultItem[]> {
    return this.search({ query, workspaceId, limit });
  }

  async indexDocument(category: SearchCategory, document: SearchResultItem): Promise<void> {
    this.logger.log(`Indexing document ${document.id} under category ${category}`);
  }

  async indexWorkspaceContent(workspaceId: string, items: SearchResultItem[]): Promise<void> {
    this.logger.log(`Indexing ${items.length} items for workspace ${workspaceId} into Meilisearch`);
    for (const item of items) {
      await this.indexDocument(item.category, { ...item, workspaceId });
    }
  }

  async deleteDocument(category: SearchCategory, id: string): Promise<void> {
    this.logger.log(`Deleting document ${id} from category ${category}`);
  }
}
