import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { PromptTemplate } from '@org/types';
import type {
  CreatePromptTemplateInput,
  UpdatePromptTemplateInput,
} from '@org/validation';

/**
 * The prompt library.
 *
 * Two kinds of row live in one table. System templates (`isSystem`, with no
 * workspace) ship with the platform and are readable by everyone; workspace
 * templates belong to one tenant. A workspace's library is the union, which is
 * why `list` reads both and why every write path re-checks `workspaceId` — a
 * template with no workspace must never be editable through a workspace-scoped
 * route.
 */
@Injectable()
export class PromptTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string): Promise<PromptTemplate[]> {
    const templates = await this.prisma.promptTemplate.findMany({
      where: { OR: [{ workspaceId }, { isSystem: true }] },
      orderBy: [{ isSystem: 'desc' }, { category: 'asc' }, { title: 'asc' }],
    });

    return templates.map((template) => ({
      id: template.id,
      workspaceId: template.workspaceId,
      title: template.title,
      category: template.category,
      promptText: template.promptText,
      isSystem: template.isSystem,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    }));
  }

  async create(
    workspaceId: string,
    input: CreatePromptTemplateInput,
  ): Promise<PromptTemplate> {
    const created = await this.prisma.promptTemplate.create({
      data: {
        workspaceId,
        title: input.title,
        category: input.category ?? 'General',
        promptText: input.promptText,
        // Only a migration mints a system template.
        isSystem: false,
      },
    });

    return {
      id: created.id,
      workspaceId: created.workspaceId,
      title: created.title,
      category: created.category,
      promptText: created.promptText,
      isSystem: created.isSystem,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async update(
    workspaceId: string,
    templateId: string,
    input: UpdatePromptTemplateInput,
  ): Promise<PromptTemplate> {
    await this.assertOwned(workspaceId, templateId);

    const updated = await this.prisma.promptTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.promptText === undefined
          ? {}
          : { promptText: input.promptText }),
      },
    });

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      title: updated.title,
      category: updated.category,
      promptText: updated.promptText,
      isSystem: updated.isSystem,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async remove(workspaceId: string, templateId: string): Promise<void> {
    await this.assertOwned(workspaceId, templateId);
    await this.prisma.promptTemplate.delete({ where: { id: templateId } });
  }

  /**
   * A workspace may only write its own templates.
   *
   * Matching on the id alone would let one tenant edit another's prompt — and
   * would let anyone rewrite the shared system templates, which are visible in
   * every workspace.
   */
  private async assertOwned(
    workspaceId: string,
    templateId: string,
  ): Promise<void> {
    const owned = await this.prisma.promptTemplate.findFirst({
      where: { id: templateId, workspaceId, isSystem: false },
      select: { id: true },
    });

    if (!owned) {
      throw new NotFoundException('No such prompt template in this workspace.');
    }
  }
}
