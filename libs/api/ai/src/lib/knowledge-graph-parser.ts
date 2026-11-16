import { createHash } from 'node:crypto';
import type { GraphEntityType, GraphRelationType } from '@org/types';

export interface ParsedGraphEntity {
  entityType: GraphEntityType;
  name: string;
  identifier: string;
  description?: string;
  sourceRef?: string;
  sourceType: string;
  sourceUri?: string;
  contentHash?: string;
  confidence: number;
  provenance: string;
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ParsedGraphRelation {
  relationType: GraphRelationType;
  sourceIdentifier: string;
  targetIdentifier: string;
  weight: number;
  confidence: number;
  provenance: string;
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface CodeParseResult {
  entities: ParsedGraphEntity[];
  relations: ParsedGraphRelation[];
  fileCount: number;
  symbolCount: number;
}

const SENSITIVE_FILENAME_PATTERNS = [
  /\.env(\..*)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /\.secret/i,
  /credentials\.json/i,
  /\.npmrc/i,
  /\.p8$/i,
  /\.p12$/i,
  /\.pfx$/i,
];

const SECRET_PATTERNS = [
  /(api[_-]?key|secret|password|bearer|auth[_-]?token|access[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_.-]{8,}['"]/gi,
  /Bearer\s+[a-zA-Z0-9_.-]{16,}/gi,
  /ghp_[a-zA-Z0-9]{36}/gi,
  /glpat-[a-zA-Z0-9_-]{20}/gi,
  /sk-[a-zA-Z0-9]{32,}/gi,
];

/**
 * Checks if a file path is a secret or sensitive config file that should never be indexed.
 */
export function isSensitiveFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  return SENSITIVE_FILENAME_PATTERNS.some((pattern) => pattern.test(norm));
}

/**
 * Scrubs potential secrets from raw text before indexing.
 */
export function scrubSecrets(text: string): string {
  let clean = text;
  for (const pattern of SECRET_PATTERNS) {
    clean = clean.replace(pattern, '$1: "[REDACTED_SECRET]"');
  }
  return clean;
}

/**
 * Computes deterministic SHA-256 hash.
 */
export function computeHash(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Deterministic local code parser: extracts AST symbols, React components,
 * functions, classes, imports, exports, API endpoints, hooks and DB models
 * without any external paid LLM or parser service.
 */
export class DeterministicCodeParser {
  /**
   * Parses multiple code files (e.g. from a repository or uploaded folder)
   * and extracts a connected property graph.
   */
  parseRepository(
    repoName: string,
    files: Array<{ filePath: string; content: string }>,
  ): CodeParseResult {
    const entities: ParsedGraphEntity[] = [];
    const relations: ParsedGraphRelation[] = [];
    const foldersSeen = new Set<string>();

    const repoId = `repo:${repoName}`;
    entities.push({
      entityType: 'Repository',
      name: repoName,
      identifier: repoId,
      description: `Repository ${repoName}`,
      sourceType: 'CODE_REPO',
      sourceUri: `repo://${repoName}`,
      confidence: 1.0,
      provenance: 'DETERMINISTIC_PARSER',
      properties: { totalFiles: files.length },
      metadata: {},
    });

    let parsedFilesCount = 0;
    for (const file of files) {
      if (isSensitiveFile(file.filePath)) continue;
      parsedFilesCount++;

      const normPath = file.filePath.replace(/\\/g, '/').replace(/^\/+/, '');
      const pathParts = normPath.split('/');
      const fileName = pathParts[pathParts.length - 1] ?? normPath;

      // Extract Folder hierarchy
      let currentFolderPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i]!;
        const parentFolderPath = currentFolderPath;
        currentFolderPath = currentFolderPath
          ? `${currentFolderPath}/${folderName}`
          : folderName;
        const folderId = `folder:${repoName}/${currentFolderPath}`;

        if (!foldersSeen.has(folderId)) {
          foldersSeen.add(folderId);
          entities.push({
            entityType: 'Folder',
            name: folderName,
            identifier: folderId,
            sourceType: 'CODE_REPO',
            sourceUri: `repo://${repoName}/${currentFolderPath}`,
            confidence: 1.0,
            provenance: 'DETERMINISTIC_PARSER',
            properties: { path: currentFolderPath },
            metadata: {},
          });

          if (parentFolderPath) {
            relations.push({
              relationType: 'contains',
              sourceIdentifier: `folder:${repoName}/${parentFolderPath}`,
              targetIdentifier: folderId,
              weight: 1.0,
              confidence: 1.0,
              provenance: 'DETERMINISTIC_PARSER',
              properties: {},
              metadata: {},
            });
          } else {
            relations.push({
              relationType: 'contains',
              sourceIdentifier: repoId,
              targetIdentifier: folderId,
              weight: 1.0,
              confidence: 1.0,
              provenance: 'DETERMINISTIC_PARSER',
              properties: {},
              metadata: {},
            });
          }
        }
      }

      // File Entity
      const fileId = `file:${repoName}/${normPath}`;
      const safeContent = scrubSecrets(file.content);
      const lines = safeContent.split('\n');
      const ext = fileName.includes('.')
        ? (fileName.split('.').pop()?.toLowerCase() ?? '')
        : '';

      entities.push({
        entityType: 'SourceFile',
        name: fileName,
        identifier: fileId,
        description: `Source file at ${normPath}`,
        sourceRef: normPath,
        sourceType: 'CODE_REPO',
        sourceUri: `repo://${repoName}/${normPath}`,
        contentHash: computeHash(safeContent),
        confidence: 1.0,
        provenance: 'DETERMINISTIC_PARSER',
        properties: {
          path: normPath,
          extension: ext,
          lineCount: lines.length,
          sizeBytes: safeContent.length,
        },
        metadata: {},
      });

      // Link to parent folder or repo
      if (currentFolderPath) {
        relations.push({
          relationType: 'contains',
          sourceIdentifier: `folder:${repoName}/${currentFolderPath}`,
          targetIdentifier: fileId,
          weight: 1.0,
          confidence: 1.0,
          provenance: 'DETERMINISTIC_PARSER',
          properties: {},
          metadata: {},
        });
      } else {
        relations.push({
          relationType: 'contains',
          sourceIdentifier: repoId,
          targetIdentifier: fileId,
          weight: 1.0,
          confidence: 1.0,
          provenance: 'DETERMINISTIC_PARSER',
          properties: {},
          metadata: {},
        });
      }

      // If package.json, extract dependencies
      if (fileName === 'package.json') {
        try {
          const pkg = JSON.parse(safeContent);
          const allDeps = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {}),
          };
          for (const [depName, version] of Object.entries(allDeps)) {
            const pkgId = `pkg:${depName}`;
            entities.push({
              entityType: 'Integration',
              name: depName,
              identifier: pkgId,
              description: `NPM package ${depName}@${version}`,
              sourceType: 'PACKAGE_DEPENDENCY',
              confidence: 1.0,
              provenance: 'DETERMINISTIC_PARSER',
              properties: { version, manager: 'npm' },
              metadata: {},
            });
            relations.push({
              relationType: 'depends_on',
              sourceIdentifier: fileId,
              targetIdentifier: pkgId,
              weight: 1.0,
              confidence: 1.0,
              provenance: 'DETERMINISTIC_PARSER',
              properties: { version },
              metadata: {},
            });
          }
        } catch {
          // ignore invalid JSON
        }
        continue;
      }

      // Parse JS, JSX, TS, TSX files
      if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
        this.parseSourceFileCode(
          repoName,
          normPath,
          fileId,
          safeContent,
          entities,
          relations,
        );
      }
    }

    // Deduplicate entities by identifier
    const uniqueEntitiesMap = new Map<string, ParsedGraphEntity>();
    for (const e of entities) {
      if (!uniqueEntitiesMap.has(e.identifier)) {
        uniqueEntitiesMap.set(e.identifier, e);
      }
    }

    return {
      entities: Array.from(uniqueEntitiesMap.values()),
      relations,
      fileCount: parsedFilesCount,
      symbolCount: entities.length,
    };
  }

  public isSensitiveFile(filePath: string): boolean {
    return isSensitiveFile(filePath);
  }

  public scrubSecrets(text: string): string {
    return scrubSecrets(text);
  }

  public parseSourceFile(
    filePath: string,
    content: string,
    repoName = 'default',
  ): { entities: ParsedGraphEntity[]; relations: ParsedGraphRelation[] } {
    const entities: ParsedGraphEntity[] = [];
    const relations: ParsedGraphRelation[] = [];
    const normPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fileId = `file:${repoName}/${normPath}`;
    const safeContent = scrubSecrets(content);

    entities.push({
      entityType: 'SOURCE_FILE',
      name: normPath,
      identifier: fileId,
      sourceType: 'CODE_REPO',
      confidence: 1.0,
      provenance: 'LOCAL_AST_PARSER',
      contentHash: computeHash(content),
      properties: {},
      metadata: {},
    });

    const ext = normPath.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'json' && normPath.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(content) as Record<string, unknown>;
        const allDeps = {
          ...((pkg['dependencies'] as Record<string, string>) ?? {}),
          ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
        };
        for (const [dep, ver] of Object.entries(allDeps)) {
          const depId = `package:${dep}`;
          entities.push({
            entityType: 'APPLICATION',
            name: dep,
            identifier: depId,
            sourceType: 'PACKAGE_DEPENDENCY',
            confidence: 1.0,
            provenance: 'LOCAL_AST_PARSER',
            contentHash: computeHash(`${dep}@${ver}`),
            properties: { version: ver },
            metadata: {},
          });
          relations.push({
            relationType: 'DEPENDS_ON',
            sourceIdentifier: fileId,
            targetIdentifier: depId,
            weight: 1.0,
            confidence: 1.0,
            provenance: 'LOCAL_AST_PARSER',
            properties: {},
            metadata: {},
          });
        }
      } catch {
        // ignore malformed package.json
      }
    } else if (normPath.endsWith('.prisma') || ext === 'prisma') {
      const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/g;
      let modelMatch: RegExpExecArray | null;
      while ((modelMatch = modelRegex.exec(content)) !== null) {
        const modelName = modelMatch[1];
        if (!modelName) continue;
        const modelId = `model:${modelName}`;
        entities.push({
          entityType: 'DATABASE',
          name: modelName,
          identifier: modelId,
          sourceType: 'PRISMA_SCHEMA',
          confidence: 1.0,
          provenance: 'LOCAL_AST_PARSER',
          contentHash: computeHash(modelMatch[0]),
          properties: {},
          metadata: {},
        });
        const relationRegex = /@relation\([^)]*references:\s*\[([^\]]+)\]/g;
        if (relationRegex.test(modelMatch[2] ?? '')) {
          relations.push({
            relationType: 'REFERENCES',
            sourceIdentifier: modelId,
            targetIdentifier: `model:Relation`,
            weight: 1.0,
            confidence: 1.0,
            provenance: 'LOCAL_AST_PARSER',
            properties: {},
            metadata: {},
          });
        }
      }
    } else {
      this.parseSourceFileCode(
        repoName,
        normPath,
        fileId,
        safeContent,
        entities,
        relations,
      );
    }

    return { entities, relations };
  }

  private parseSourceFileCode(
    repoName: string,
    filePath: string,
    fileId: string,
    content: string,
    entities: ParsedGraphEntity[],
    relations: ParsedGraphRelation[],
  ): void {
    // 1. Imports
    // e.g. import { A, B } from './path' or import C from 'lib'
    const importRegex =
      /import\s+(?:(?:\*\s+as\s+(\w+))|(?:\{([^}]+)\})|(?:(\w+)(?:,\s*\{([^}]+)\})?))\s+from\s+['"]([^'"]+)['"]/g;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = importRegex.exec(content)) !== null) {
      const modulePath = importMatch[5];
      if (!modulePath) continue;

      let targetIdentifier = `module:${modulePath}`;
      if (modulePath.startsWith('.')) {
        // Resolve relative path
        const resolvedPath = this.resolveRelativePath(filePath, modulePath);
        targetIdentifier = `file:${repoName}/${resolvedPath}`;
      }

      relations.push({
        relationType: 'imports',
        sourceIdentifier: fileId,
        targetIdentifier,
        weight: 1.0,
        confidence: 0.95,
        provenance: 'DETERMINISTIC_PARSER',
        properties: { rawPath: modulePath },
        metadata: {},
      });
    }

    // CommonJS require
    const requireRegex =
      /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    let reqMatch: RegExpExecArray | null;
    while ((reqMatch = requireRegex.exec(content)) !== null) {
      const mod = reqMatch[3];
      if (!mod) continue;
      const targetId = mod.startsWith('.')
        ? `file:${repoName}/${this.resolveRelativePath(filePath, mod)}`
        : `module:${mod}`;
      relations.push({
        relationType: 'imports',
        sourceIdentifier: fileId,
        targetIdentifier: targetId,
        weight: 1.0,
        confidence: 0.9,
        provenance: 'DETERMINISTIC_PARSER',
        properties: { rawPath: mod },
        metadata: {},
      });
    }

    // 2. Classes
    // e.g. class FooService extends Bar implements Baz
    const classRegex =
      /(?:export\s+)?(?:default\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?/g;
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classRegex.exec(content)) !== null) {
      const className = classMatch[1]!;
      const superClass = classMatch[2];
      const classId = `class:${repoName}/${filePath}#${className}`;

      entities.push({
        entityType: 'Class',
        name: className,
        identifier: classId,
        description: `Class ${className} in ${filePath}`,
        sourceRef: filePath,
        sourceType: 'CODE_SYMBOL',
        confidence: 1.0,
        provenance: 'DETERMINISTIC_PARSER',
        properties: {
          superClass: superClass ?? null,
          isExported: classMatch[0].includes('export'),
        },
        metadata: {},
      });

      relations.push({
        relationType: 'contains',
        sourceIdentifier: fileId,
        targetIdentifier: classId,
        weight: 1.0,
        confidence: 1.0,
        provenance: 'DETERMINISTIC_PARSER',
        properties: {},
        metadata: {},
      });

      if (superClass) {
        relations.push({
          relationType: 'derived_from',
          sourceIdentifier: classId,
          targetIdentifier: `class:${superClass}`,
          weight: 1.0,
          confidence: 0.85,
          provenance: 'DETERMINISTIC_PARSER',
          properties: {},
          metadata: {},
        });
      }
    }

    // 3. React Components & Functions
    // Function declaration: function Foo(...) or const Foo = (...) =>
    const funcDeclRegex =
      /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    let funcMatch: RegExpExecArray | null;
    while ((funcMatch = funcDeclRegex.exec(content)) !== null) {
      const name = funcMatch[1]!;
      const params = funcMatch[2]?.trim() ?? '';
      this.registerFunctionOrComponent(
        repoName,
        filePath,
        fileId,
        name,
        params,
        funcMatch[0].includes('export'),
        content,
        entities,
        relations,
      );
    }

    // Arrow functions assigned to const/let: const MyComponent = (...) =>
    const arrowFuncRegex =
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>/g;
    let arrowMatch: RegExpExecArray | null;
    while ((arrowMatch = arrowFuncRegex.exec(content)) !== null) {
      const name = arrowMatch[1]!;
      const params = arrowMatch[2]?.trim() ?? '';
      this.registerFunctionOrComponent(
        repoName,
        filePath,
        fileId,
        name,
        params,
        arrowMatch[0].includes('export'),
        content,
        entities,
        relations,
      );
    }

    // 4. API Endpoints (NestJS decorators or Express route calls)
    // @Controller('route') and @Get('path'), @Post('path'), etc.
    const controllerMatch =
      /@Controller\s*\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/.exec(content);
    const controllerPrefix = controllerMatch
      ? (controllerMatch[1] ?? controllerMatch[2] ?? '')
      : '';

    const endpointRegex =
      /@(Get|Post|Put|Delete|Patch)\s*\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)\s*(?:\n\s*@[^\n]+)*\s*(?:async\s+)?(\w+)\s*\(/g;
    let epMatch: RegExpExecArray | null;
    while ((epMatch = endpointRegex.exec(content)) !== null) {
      const method = epMatch[1]!.toUpperCase();
      const subPath = epMatch[2] ?? epMatch[3] ?? '';
      const fullPath =
        `/${controllerPrefix}/${subPath}`
          .replace(/\/+/g, '/')
          .replace(/\/$/, '') || '/';
      const handlerName = epMatch[4]!;
      const epId = `endpoint:${method}:${fullPath}`;

      entities.push({
        entityType: 'Endpoint',
        name: `${method} ${fullPath}`,
        identifier: epId,
        description: `API Endpoint ${method} ${fullPath} handled by ${handlerName}`,
        sourceRef: filePath,
        sourceType: 'API_ENDPOINT',
        confidence: 1.0,
        provenance: 'DETERMINISTIC_PARSER',
        properties: { method, path: fullPath, handler: handlerName },
        metadata: {},
      });

      relations.push({
        relationType: 'contains',
        sourceIdentifier: fileId,
        targetIdentifier: epId,
        weight: 1.0,
        confidence: 1.0,
        provenance: 'DETERMINISTIC_PARSER',
        properties: {},
        metadata: {},
      });

      // Link endpoint to handler function
      relations.push({
        relationType: 'calls',
        sourceIdentifier: epId,
        targetIdentifier: `func:${repoName}/${filePath}#${handlerName}`,
        weight: 1.0,
        confidence: 0.95,
        provenance: 'DETERMINISTIC_PARSER',
        properties: {},
        metadata: {},
      });
    }

    // 5. Database Model References (e.g. this.prisma.user.findMany, prisma.task.create)
    const prismaModelRegex =
      /prisma\.(\w+)\.(findMany|findUnique|findFirst|create|update|delete|upsert|count)/g;
    let dbMatch: RegExpExecArray | null;
    while ((dbMatch = prismaModelRegex.exec(content)) !== null) {
      const model = dbMatch[1]!;
      const operation = dbMatch[2]!;
      const dbModelId = `db:model:${model}`;

      entities.push({
        entityType: 'Database',
        name: `Prisma ${model}`,
        identifier: dbModelId,
        description: `Database model ${model}`,
        sourceType: 'DATABASE_MODEL',
        confidence: 1.0,
        provenance: 'DETERMINISTIC_PARSER',
        properties: { model },
        metadata: {},
      });

      relations.push({
        relationType: 'uses',
        sourceIdentifier: fileId,
        targetIdentifier: dbModelId,
        weight: 1.0,
        confidence: 0.9,
        provenance: 'DETERMINISTIC_PARSER',
        properties: { operation },
        metadata: {},
      });
    }

    // 6. Hook usages inside components / functions
    // e.g. useMemo, useState, useQuery, useCustomHook
    const hookRegex = /\b(use[A-Z]\w+)\s*\(/g;
    let hookMatch: RegExpExecArray | null;
    const hooksUsed = new Set<string>();
    while ((hookMatch = hookRegex.exec(content)) !== null) {
      const hookName = hookMatch[1]!;
      if (!hooksUsed.has(hookName)) {
        hooksUsed.add(hookName);
        const hookId = `hook:${hookName}`;

        entities.push({
          entityType: 'Hook',
          name: hookName,
          identifier: hookId,
          description: `React Hook ${hookName}`,
          sourceType: 'HOOK',
          confidence: 1.0,
          provenance: 'DETERMINISTIC_PARSER',
          properties: {},
          metadata: {},
        });

        relations.push({
          relationType: 'uses',
          sourceIdentifier: fileId,
          targetIdentifier: hookId,
          weight: 0.8,
          confidence: 0.9,
          provenance: 'DETERMINISTIC_PARSER',
          properties: {},
          metadata: {},
        });
      }
    }
  }

  private registerFunctionOrComponent(
    repoName: string,
    filePath: string,
    fileId: string,
    name: string,
    params: string,
    isExported: boolean,
    fullContent: string,
    entities: ParsedGraphEntity[],
    relations: ParsedGraphRelation[],
  ): void {
    // Determine if it's a React Component: PascalCase and returns JSX or file is .jsx/.tsx
    const isPascalCase = /^[A-Z][a-zA-Z0-9]+$/.test(name);
    const isComponent =
      isPascalCase &&
      (filePath.endsWith('.tsx') ||
        filePath.endsWith('.jsx') ||
        fullContent.includes(`<${name}`) ||
        fullContent.includes('return <'));
    const isHook =
      name.startsWith('use') && name.length > 3 && /^[A-Z]/.test(name.slice(3));

    const entityType: GraphEntityType = isComponent
      ? 'Component'
      : isHook
        ? 'Hook'
        : 'Function';
    const symbolId = `${isComponent ? 'comp' : isHook ? 'hook' : 'func'}:${repoName}/${filePath}#${name}`;

    entities.push({
      entityType,
      name,
      identifier: symbolId,
      description: `${entityType} ${name} in ${filePath}`,
      sourceRef: filePath,
      sourceType: 'CODE_SYMBOL',
      confidence: 1.0,
      provenance: 'DETERMINISTIC_PARSER',
      properties: {
        parameters: params ? params.split(',').map((p) => p.trim()) : [],
        isExported,
        filePath,
      },
      metadata: {},
    });

    relations.push({
      relationType: isExported ? 'exports' : 'contains',
      sourceIdentifier: fileId,
      targetIdentifier: symbolId,
      weight: 1.0,
      confidence: 1.0,
      provenance: 'DETERMINISTIC_PARSER',
      properties: {},
      metadata: {},
    });

    // Check rendered components inside this component/function
    if (isComponent) {
      const renderRegex = /<([A-Z]\w+)(?:\s|\/|>)/g;
      let rMatch: RegExpExecArray | null;
      const renderedSet = new Set<string>();
      while ((rMatch = renderRegex.exec(fullContent)) !== null) {
        const childName = rMatch[1]!;
        if (childName !== name && !renderedSet.has(childName)) {
          renderedSet.add(childName);
          relations.push({
            relationType: 'renders',
            sourceIdentifier: symbolId,
            targetIdentifier: `comp:${childName}`,
            weight: 0.9,
            confidence: 0.8,
            provenance: 'DETERMINISTIC_PARSER',
            properties: {},
            metadata: {},
          });
        }
      }
    }
  }

  private resolveRelativePath(
    currentFilePath: string,
    relativePath: string,
  ): string {
    const curParts = currentFilePath.split('/');
    curParts.pop(); // remove file name
    const relParts = relativePath.split('/');

    for (const part of relParts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        curParts.pop();
      } else {
        curParts.push(part);
      }
    }
    const resolved = curParts.join('/');
    return resolved.endsWith('.js') ||
      resolved.endsWith('.ts') ||
      resolved.endsWith('.tsx') ||
      resolved.endsWith('.jsx')
      ? resolved
      : `${resolved}.ts`;
  }
}
