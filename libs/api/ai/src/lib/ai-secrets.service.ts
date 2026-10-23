import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { CreateAISecretInput } from '@org/types';
import { AIEncryptionService } from './ai-encryption.service.js';

@Injectable()
export class AISecretsService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: AIEncryptionService,
  ) {}

  async listSecrets(workspaceId: string) {
    const secrets = await this.prisma.aISecret.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        createdById: true,
        key: true,
        maskedValue: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { key: 'asc' },
    });
    return secrets;
  }

  async createSecret(
    workspaceId: string,
    userId: string | undefined,
    data: CreateAISecretInput,
  ) {
    const key = data.key.trim().toUpperCase();
    const encryptedValue = this.encryption.encrypt(data.value);
    const maskedValue =
      data.value.length > 4
        ? '••••••••' + data.value.slice(-4)
        : '••••••••';

    return this.prisma.aISecret.upsert({
      where: {
        workspaceId_key: { workspaceId, key },
      },
      create: {
        workspaceId,
        createdById: userId,
        key,
        encryptedValue,
        maskedValue,
        description: data.description,
      },
      update: {
        encryptedValue,
        maskedValue,
        description: data.description,
      },
      select: {
        id: true,
        workspaceId: true,
        key: true,
        maskedValue: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteSecret(workspaceId: string, key: string) {
    const upperKey = key.trim().toUpperCase();
    const existing = await this.prisma.aISecret.findUnique({
      where: {
        workspaceId_key: { workspaceId, key: upperKey },
      },
    });
    if (!existing) throw new NotFoundException(`Secret '${upperKey}' not found`);

    await this.prisma.aISecret.delete({
      where: { id: existing.id },
    });
  }

  /**
   * Internal method for engines to resolve a secret securely.
   * Never exposed to HTTP response!
   */
  async getDecryptedSecret(workspaceId: string, key: string): Promise<string | null> {
    const secret = await this.prisma.aISecret.findUnique({
      where: {
        workspaceId_key: { workspaceId, key: key.trim().toUpperCase() },
      },
    });
    if (!secret) return null;
    return this.encryption.decrypt(secret.encryptedValue);
  }

  /**
   * Fills `{{secrets.KEY}}` references in author-written config (never in run
   * data) with decrypted values, so a workflow can call an API without the key
   * living in the workflow definition. Throws on an unknown key rather than
   * sending a request with an empty credential.
   */
  async resolveSecretRefs(workspaceId: string, template: string): Promise<string> {
    const pattern = /\{\{\s*secrets\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
    const keys = [...new Set([...template.matchAll(pattern)].map((m) => (m[1] as string).toUpperCase()))];
    if (keys.length === 0) return template;
    const values = new Map<string, string>();
    for (const key of keys) {
      const value = await this.getDecryptedSecret(workspaceId, key);
      if (value === null) throw new Error(`Secret '${key}' is not defined in this workspace. Add it under Setup → Secrets.`);
      values.set(key, value);
    }
    return template.replace(pattern, (_, key: string) => values.get(key.toUpperCase()) ?? '');
  }
}
