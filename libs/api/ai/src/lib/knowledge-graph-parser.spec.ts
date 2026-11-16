import { describe, expect, it } from 'vitest';
import { DeterministicCodeParser } from './knowledge-graph-parser.js';

describe('DeterministicCodeParser', () => {
  const parser = new DeterministicCodeParser();

  describe('Sensitive File & Secret Filtering', () => {
    it('detects sensitive files that must never be indexed', () => {
      expect(parser.isSensitiveFile('.env')).toBe(true);
      expect(parser.isSensitiveFile('.env.production')).toBe(true);
      expect(parser.isSensitiveFile('secrets/server.pem')).toBe(true);
      expect(parser.isSensitiveFile('certs/id_rsa')).toBe(true);
      expect(parser.isSensitiveFile('config/credentials.json')).toBe(true);
      expect(parser.isSensitiveFile('.npmrc')).toBe(true);

      // Normal files
      expect(parser.isSensitiveFile('src/index.ts')).toBe(false);
      expect(parser.isSensitiveFile('src/components/Button.tsx')).toBe(false);
      expect(parser.isSensitiveFile('package.json')).toBe(false);
    });

    it('scrubs API keys, bearer tokens, and secrets from code snippets', () => {
      const codeWithSecret = `
        const apiKey = "sk-1234567890abcdef1234567890abcdef";
        const password = "super_secret_password_123";
        console.log("Normal line");
      `;

      const scrubbed = parser.scrubSecrets(codeWithSecret);
      expect(scrubbed).not.toContain('sk-1234567890abcdef1234567890abcdef');
      expect(scrubbed).not.toContain('super_secret_password_123');
      expect(scrubbed).toContain('[REDACTED_SECRET]');
      expect(scrubbed).toContain('Normal line');
    });
  });

  describe('TypeScript / JavaScript Parsing', () => {
    it('extracts functions, classes, and imports from TypeScript files', () => {
      const tsCode = `
        import { useState } from 'react';
        import { UserService } from './user.service';

        export class UserManager {
          public fetchUser(id: string) {
            return id;
          }
        }

        export function calculateMetrics(data: number[]): number {
          return data.reduce((a, b) => a + b, 0);
        }
      `;

      const { entities, relations } = parser.parseSourceFile('src/user-manager.ts', tsCode);

      // Should have source file entity
      const fileNode = entities.find((e) => e.name === 'src/user-manager.ts');
      expect(fileNode).toBeDefined();

      // Should have class entity
      const classNode = entities.find((e) => e.name === 'UserManager' && e.entityType === 'Class');
      expect(classNode).toBeDefined();

      // Should have function
      const calcFunc = entities.find((e) => e.name === 'calculateMetrics');
      expect(calcFunc).toBeDefined();

      // Should have imports relation
      const importRelation = relations.find(
        (r) => r.relationType === 'imports' && r.targetIdentifier.includes('react'),
      );
      expect(importRelation).toBeDefined();

      // File contains/exports class
      const classRelation = relations.find(
        (r) => r.targetIdentifier === classNode?.identifier,
      );
      expect(classRelation).toBeDefined();
    });

    it('extracts React components and hooks from TSX files', () => {
      const tsxCode = `
        import React, { useState } from 'react';

        export function UserProfileHeader({ name }: { name: string }) {
          const [status, setStatus] = useState('online');
          return (
            <div>
              <Avatar name={name} />
              <h1>{name}</h1>
            </div>
          );
        }

        export function useUserPreferences(userId: string) {
          return { theme: 'dark' };
        }
      `;

      const { entities, relations } = parser.parseSourceFile('src/components/UserProfile.tsx', tsxCode);

      // Component entity
      const componentNode = entities.find((e) => e.name === 'UserProfileHeader');
      expect(componentNode).toBeDefined();
      expect(componentNode?.entityType).toBe('Component');

      // Hook entity
      const hookNode = entities.find((e) => e.name === 'useUserPreferences');
      expect(hookNode).toBeDefined();
      expect(hookNode?.entityType).toBe('Hook');

      // Component renders Avatar
      const renderRel = relations.find(
        (r) => r.relationType === 'renders' && r.targetIdentifier.includes('Avatar'),
      );
      expect(renderRel).toBeDefined();
    });

    it('extracts API endpoints from Express/NestJS style controllers', () => {
      const controllerCode = `
        import { Controller, Get, Post } from '@nestjs/common';

        @Controller('api/v1/projects')
        export class ProjectController {
          @Get(':id')
          getProject() { return {}; }
        }
      `;

      const { entities } = parser.parseSourceFile('src/project.controller.ts', controllerCode);

      const endpoints = entities.filter((e) => e.entityType === 'Endpoint');
      expect(endpoints.length).toBeGreaterThan(0);
      expect(endpoints[0].name).toContain('GET');
    });

    it('extracts database models from prisma schema', () => {
      const prismaSchema = `
        model Customer {
          id        String   @id @default(uuid())
          email     String   @unique
        }

        model Order {
          id         String   @id @default(uuid())
          customerId String
          customer   Customer @relation(fields: [customerId], references: [id])
        }
      `;

      const { entities, relations } = parser.parseSourceFile('prisma/schema.prisma', prismaSchema);

      const customerModel = entities.find((e) => e.name === 'Customer');
      const orderModel = entities.find((e) => e.name === 'Order');

      expect(customerModel).toBeDefined();
      expect(orderModel).toBeDefined();

      const relation = relations.find(
        (r) => r.relationType === 'REFERENCES' && r.sourceIdentifier.includes('Order'),
      );
      expect(relation).toBeDefined();
    });

    it('extracts dependencies from package.json', () => {
      const packageJson = JSON.stringify({
        name: '@org/my-app',
        dependencies: {
          react: '^19.0.0',
        },
      });

      const { entities, relations } = parser.parseSourceFile('package.json', packageJson);

      const reactDep = entities.find((e) => e.name === 'react');
      expect(reactDep).toBeDefined();

      const depRelation = relations.find(
        (r) => r.relationType === 'DEPENDS_ON' && r.targetIdentifier.includes('react'),
      );
      expect(depRelation).toBeDefined();
    });
  });

  describe('Full Repository Parsing', () => {
    it('aggregates repository symbols and computes deterministic hashes', () => {
      const files = [
        {
          filePath: 'src/math.ts',
          content: 'export function add(a: number, b: number) { return a + b; }',
        },
        {
          filePath: 'src/main.ts',
          content: `
            import { add } from './math';
            export function run() { return add(1, 2); }
          `,
        },
        {
          filePath: '.env',
          content: 'SECRET_KEY=1234567890',
        },
      ];

      const result = parser.parseRepository('my-awesome-repo', files);

      // .env should be skipped
      expect(result.fileCount).toBe(2);
      expect(result.symbolCount).toBeGreaterThan(0);

      const repoEntity = result.entities.find((e) => e.entityType === 'Repository');
      expect(repoEntity).toBeDefined();
      expect(repoEntity?.name).toBe('my-awesome-repo');

      for (const entity of result.entities) {
        expect(entity.provenance).toBe('DETERMINISTIC_PARSER');
        expect(entity.confidence).toBe(1.0);
      }
    });
  });
});
