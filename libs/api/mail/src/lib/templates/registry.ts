import { Injectable, Logger, Optional } from '@nestjs/common';
import type { EmailTemplateCategory, EmailTemplateDefinition, EmailTemplateStatus } from '@org/types';
import { PrismaService, type EmailTemplate, type Prisma } from '@org/database';
import { AUTH_TEMPLATES } from './definitions/auth.templates.js';
import { WORKSPACE_TEMPLATES } from './definitions/workspace.templates.js';
import { TEAM_TEMPLATES } from './definitions/team.templates.js';
import { PROJECT_TASK_TEMPLATES } from './definitions/project-task.templates.js';
import { DOCS_TEMPLATES } from './definitions/docs.templates.js';
import { MESSAGING_TEMPLATES } from './definitions/messaging.templates.js';
import { MEETINGS_TEMPLATES } from './definitions/meetings.templates.js';
import { AI_AGENTS_TEMPLATES } from './definitions/ai-agents.templates.js';
import { HIRE_TEMPLATES } from './definitions/hire.templates.js';
import { VOICE_TEMPLATES } from './definitions/voice.templates.js';
import { BILLING_TEMPLATES } from './definitions/billing.templates.js';
import { SECURITY_TEMPLATES } from './definitions/security.templates.js';
import { SYSTEM_TEMPLATES } from './definitions/system.templates.js';

export const ALL_SYSTEM_TEMPLATES: EmailTemplateDefinition[] = [
  ...AUTH_TEMPLATES,
  ...WORKSPACE_TEMPLATES,
  ...TEAM_TEMPLATES,
  ...PROJECT_TASK_TEMPLATES,
  ...DOCS_TEMPLATES,
  ...MESSAGING_TEMPLATES,
  ...MEETINGS_TEMPLATES,
  ...AI_AGENTS_TEMPLATES,
  ...HIRE_TEMPLATES,
  ...VOICE_TEMPLATES,
  ...BILLING_TEMPLATES,
  ...SECURITY_TEMPLATES,
  ...SYSTEM_TEMPLATES,
];

type TemplateInput = Partial<EmailTemplateDefinition> & { templateKey: string };

function normalizeKey(templateKey: string): string {
  return templateKey.toUpperCase().trim();
}

/** Memory overrides are keyed per scope; `null` workspace = platform-wide. */
function scopeKey(key: string, workspaceId?: string | null): string {
  return `${workspaceId ?? '*'}::${key}`;
}

/**
 * Resolves the template a send should use: an ACTIVE workspace override, then
 * an ACTIVE platform-wide override, then the built-in system default.
 *
 * Overrides live in `email_templates`; when the database is unavailable
 * (tests, scripts) they are kept in memory for the process lifetime.
 */
@Injectable()
export class TemplateRegistry {
  private readonly logger = new Logger(TemplateRegistry.name);
  private readonly systemTemplateMap = new Map<string, EmailTemplateDefinition>();
  private readonly memoryOverrides = new Map<string, EmailTemplateDefinition>();

  constructor(@Optional() private readonly prisma?: PrismaService) {
    for (const t of ALL_SYSTEM_TEMPLATES) {
      this.systemTemplateMap.set(t.templateKey, t);
    }
  }

  getSystemTemplates(): EmailTemplateDefinition[] {
    return Array.from(this.systemTemplateMap.values());
  }

  async getTemplate(
    templateKey: string,
    workspaceId?: string | null,
  ): Promise<EmailTemplateDefinition | undefined> {
    const key = normalizeKey(templateKey);
    const scopes = workspaceId ? [workspaceId, null] : [null];

    if (this.prisma) {
      try {
        for (const scope of scopes) {
          const row = await this.prisma.emailTemplate.findFirst({
            where: { templateKey: key, status: 'ACTIVE', workspaceId: scope },
          });
          if (row) return this.mapFromPrisma(row);
        }
      } catch (err) {
        this.logger.warn(`Failed to query database for template ${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const scope of scopes) {
      const override = this.memoryOverrides.get(scopeKey(key, scope));
      if (override && override.status === 'ACTIVE') return override;
    }

    return this.systemTemplateMap.get(key);
  }

  /**
   * The catalog as seen from one scope: system defaults, overlaid by
   * platform-wide overrides, overlaid by that workspace's overrides (when a
   * workspace is given). Other workspaces' overrides never appear.
   */
  async listTemplates(params: {
    category?: EmailTemplateCategory | 'all';
    status?: EmailTemplateStatus | 'all';
    search?: string;
    workspaceId?: string | null;
  } = {}): Promise<EmailTemplateDefinition[]> {
    const { category, status, search, workspaceId } = params;

    const results = new Map<string, EmailTemplateDefinition>();
    for (const [key, t] of this.systemTemplateMap.entries()) {
      results.set(key, { ...t });
    }

    const overlay = (rows: EmailTemplateDefinition[]) => {
      for (const t of rows) results.set(t.templateKey, t);
    };

    let fromDb = false;
    if (this.prisma) {
      try {
        const rows = await this.prisma.emailTemplate.findMany({
          where: { OR: [{ workspaceId: null }, ...(workspaceId ? [{ workspaceId }] : [])] },
        });
        // Platform-wide first so workspace rows win.
        overlay(rows.filter((r) => r.workspaceId === null).map((r) => this.mapFromPrisma(r)));
        overlay(rows.filter((r) => r.workspaceId !== null).map((r) => this.mapFromPrisma(r)));
        fromDb = true;
      } catch (err) {
        this.logger.warn(`Could not load db templates: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!fromDb) {
      for (const scope of workspaceId ? [null, workspaceId] : [null]) {
        const prefix = scopeKey('', scope);
        overlay(
          [...this.memoryOverrides.entries()]
            .filter(([k]) => k.startsWith(prefix))
            .map(([, t]) => t),
        );
      }
    }

    let list = Array.from(results.values());
    if (category && category !== 'all') list = list.filter((t) => t.category === category);
    if (status && status !== 'all') list = list.filter((t) => t.status === status);
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.templateKey.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  /** Create or update the override for one scope, bumping its version. */
  async saveTemplate(input: TemplateInput, actorId?: string): Promise<EmailTemplateDefinition> {
    const key = normalizeKey(input.templateKey);
    const workspaceId = input.workspaceId ?? null;
    const base = await this.currentForScope(key, workspaceId);

    const pick = <K extends keyof EmailTemplateDefinition>(field: K) =>
      input[field] !== undefined ? input[field] : base?.[field];

    const merged: EmailTemplateDefinition = {
      templateKey: key,
      name: pick('name') || key,
      category: (pick('category') as EmailTemplateCategory) || 'SYSTEM',
      description: pick('description') || '',
      subject: pick('subject') || 'Notification',
      previewText: pick('previewText'),
      htmlBody: pick('htmlBody') || '',
      textBody: pick('textBody'),
      variablesSchema: pick('variablesSchema'),
      status: (pick('status') as EmailTemplateStatus) || 'ACTIVE',
      version: (base?.version ?? 0) + 1,
      workspaceId,
      isSystemTemplate: false,
      isDefault: false,
      updatedBy: actorId ?? null,
      updatedAt: new Date().toISOString(),
    };

    if (this.prisma) {
      try {
        const data = {
          name: merged.name,
          category: merged.category,
          description: merged.description,
          subject: merged.subject,
          previewText: merged.previewText ?? null,
          htmlBody: merged.htmlBody,
          textBody: merged.textBody ?? null,
          variablesSchema: (merged.variablesSchema ?? undefined) as Prisma.InputJsonValue | undefined,
          status: merged.status,
          version: merged.version,
          updatedBy: actorId ?? null,
        };
        // Not an upsert: Prisma rejects `null` inside a compound-unique
        // selector, which is exactly the platform-wide case.
        const existing = await this.prisma.emailTemplate.findFirst({
          where: { templateKey: key, workspaceId },
          select: { id: true },
        });
        const record = existing
          ? await this.prisma.emailTemplate.update({ where: { id: existing.id }, data })
          : await this.prisma.emailTemplate.create({
              data: { ...data, templateKey: key, workspaceId, createdBy: actorId ?? null },
            });
        return this.mapFromPrisma(record);
      } catch (err) {
        this.logger.warn(`Failed to persist template in database, using memory fallback: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.memoryOverrides.set(scopeKey(key, workspaceId), merged);
    return merged;
  }

  /** Drop the override for one scope; returns what that scope now resolves to. */
  async resetToDefault(
    templateKey: string,
    workspaceId?: string | null,
  ): Promise<EmailTemplateDefinition | undefined> {
    const key = normalizeKey(templateKey);

    if (this.prisma) {
      try {
        await this.prisma.emailTemplate.deleteMany({ where: { templateKey: key, workspaceId: workspaceId ?? null } });
      } catch (err) {
        this.logger.warn(`Could not delete db template override: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.memoryOverrides.delete(scopeKey(key, workspaceId));

    return this.getTemplate(key, workspaceId);
  }

  /** The template exactly at this scope: its own override, else the system default. */
  private async currentForScope(
    key: string,
    workspaceId: string | null,
  ): Promise<EmailTemplateDefinition | undefined> {
    if (this.prisma) {
      try {
        const row = await this.prisma.emailTemplate.findFirst({ where: { templateKey: key, workspaceId } });
        if (row) return this.mapFromPrisma(row);
      } catch {
        // fall through to memory/system
      }
    }
    return this.memoryOverrides.get(scopeKey(key, workspaceId)) ?? this.systemTemplateMap.get(key);
  }

  private mapFromPrisma(rec: EmailTemplate): EmailTemplateDefinition {
    return {
      id: rec.id,
      templateKey: rec.templateKey,
      name: rec.name,
      category: rec.category,
      description: rec.description || '',
      subject: rec.subject,
      previewText: rec.previewText || undefined,
      htmlBody: rec.htmlBody,
      textBody: rec.textBody || undefined,
      variablesSchema: (rec.variablesSchema ?? undefined) as EmailTemplateDefinition['variablesSchema'],
      status: rec.status,
      version: rec.version,
      workspaceId: rec.workspaceId,
      isSystemTemplate: rec.isSystemTemplate,
      isDefault: rec.isDefault,
      createdBy: rec.createdBy,
      updatedBy: rec.updatedBy,
      createdAt: rec.createdAt.toISOString(),
      updatedAt: rec.updatedAt.toISOString(),
    };
  }
}
