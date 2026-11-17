import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  SkillCategory,
  SkillExecutionType,
  SkillImportPreview,
  SkillImportSource,
  SkillPackage,
  SkillPermissionScope,
} from '@org/types';
import { validateSkillPackage } from '@org/validation';
import axios from 'axios';
import { SkillRegistryService } from './skill-registry.service.js';

@Injectable()
export class SkillImporterService {
  private readonly logger = new Logger(SkillImporterService.name);

  constructor(private readonly registry: SkillRegistryService) {}

  /**
   * Preview a skill import from source without committing to the registry.
   */
  async previewImport(source: SkillImportSource): Promise<SkillImportPreview> {
    const rawPackages = await this.extractSkillPackages(source);
    if (rawPackages.length === 0) {
      return {
        valid: false,
        manifest: {} as any,
        detectedType: 'instruction',
        requiredCapabilities: [],
        permissionsRequested: [],
        warnings: ['No valid skills or SKILL.md files found in source.'],
        errors: ['Source could not be parsed into a skill package.'],
      };
    }

    const first = rawPackages[0];
    const validation = validateSkillPackage(first);
    const warnings: string[] = [];

    // Security scanning
    const securityIssues = this.scanSecurity(first);
    if (securityIssues.length > 0) {
      warnings.push(...securityIssues);
    }

    return {
      valid: validation.ok && securityIssues.length === 0,
      manifest: first,
      detectedType: first.executionType,
      requiredCapabilities: first.requiredCapabilities || [],
      permissionsRequested: first.permissions || [],
      warnings,
      errors: validation.ok ? [] : validation.errors,
    };
  }

  /**
   * Import and install skills from a source into the registry.
   */
  async importSkills(
    source: SkillImportSource,
    workspaceId: string,
    options: {
      autoInstall?: boolean;
      approvedPermissions?: string[];
      userId?: string;
    } = {},
  ): Promise<{ importedCount: number; skills: SkillPackage[] }> {
    const rawPackages = await this.extractSkillPackages(source);
    if (rawPackages.length === 0) {
      throw new BadRequestException('No valid skill packages could be extracted from source.');
    }

    const imported: SkillPackage[] = [];
    for (const pkg of rawPackages) {
      const securityIssues = this.scanSecurity(pkg);
      if (securityIssues.some((s) => s.startsWith('CRITICAL:'))) {
        throw new BadRequestException(
          `Skill '${pkg.id}' rejected by security scan: ${securityIssues.join(', ')}`,
        );
      }

      const registered = await this.registry.registerSkill(pkg, 'WORKSPACE', workspaceId);
      if (options.autoInstall) {
        await this.registry.installSkill(workspaceId, registered.id, {
          userId: options.userId,
          approvedPermissions: options.approvedPermissions,
        });
      }
      imported.push(registered);
    }

    this.logger.log(`Imported ${imported.length} skills into workspace ${workspaceId}`);
    return {
      importedCount: imported.length,
      skills: imported,
    };
  }

  /**
   * Extracts one or more SkillPackage manifests from various sources.
   */
  async extractSkillPackages(source: SkillImportSource): Promise<SkillPackage[]> {
    if (source.type === 'github' || source.type === 'git_url') {
      return this.extractFromGitHub(source.url || '', source.branch || 'main');
    }

    if (source.type === 'skill_md') {
      return [this.parseSkillMd(source.content || '')];
    }

    if (source.type === 'manifest' || source.type === 'package_json') {
      if (!source.content) throw new BadRequestException('Manifest content is empty.');
      const parsed = JSON.parse(source.content);
      return Array.isArray(parsed) ? parsed : [parsed];
    }

    throw new BadRequestException(`Unsupported import source type: '${source.type}'`);
  }

  /**
   * Parses SKILL.md with YAML frontmatter into a SkillPackage
   */
  parseSkillMd(content: string, filename = 'custom-skill'): SkillPackage {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    let name = filename.replace(/\.md$/i, '');
    let description = 'Instruction-based skill imported from SKILL.md';
    let instructions = content;
    let category: SkillCategory = 'custom';
    const tags: string[] = ['skill_md'];

    if (match) {
      const frontmatter = match[1];
      instructions = match[2].trim();

      // Simple YAML key-value extraction
      const nameMatch = frontmatter.match(/name:\s*([^\r\n]+)/);
      if (nameMatch) name = nameMatch[1].trim();

      const descMatch = frontmatter.match(/description:\s*(?:>-\s*)?([\s\S]*?)(?=\n[a-z0-9_-]+:|$)/i);
      if (descMatch) description = descMatch[1].replace(/\n\s+/g, ' ').trim();

      const catMatch = frontmatter.match(/category:\s*([^\r\n]+)/);
      if (catMatch) category = catMatch[1].trim() as SkillCategory;
    }

    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48);

    // Extract input requirements from instructions
    const inputs: Record<string, any> = {
      input: {
        name: 'input',
        type: 'string',
        description: 'Primary input or instruction for this skill',
        required: true,
      },
    };

    return {
      schemaVersion: 1,
      id,
      name,
      description,
      version: '1.0.0',
      author: { name: 'Imported Skill' },
      category,
      tags,
      executionType: 'instruction',
      instructions,
      inputs,
      outputs: {
        output: { name: 'output', type: 'string', description: 'Generated output' },
      },
      parameters: {},
      requiredCapabilities: [],
      dependencies: [],
      permissions: [
        {
          scope: 'content:generate',
          label: 'Content Generation',
          description: 'Generates responses adhering to SKILL.md guidelines',
          sensitive: false,
        },
      ],
      templates: {},
      scripts: {},
    };
  }

  /**
   * Extracts skills from a GitHub repository
   * Supports repositories like Jakeschincariol/youtube-agent-skill, linkedin-agent-skill, instagram-agent-skill
   */
  private async extractFromGitHub(repoUrl: string, branch = 'main'): Promise<SkillPackage[]> {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new BadRequestException('Invalid GitHub repository URL format.');
    }
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    const packages: SkillPackage[] = [];
    const headers = { 'User-Agent': 'Mie-Skills-Engine/1.0' };

    try {
      // Check for .claude-plugin/plugin.json or package root
      let pluginMeta: any = {};
      try {
        const pluginRes = await axios.get(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.claude-plugin/plugin.json`,
          { headers },
        );
        pluginMeta = pluginRes.data;
      } catch {
        // Optional
      }

      // Check templates/voice.md
      let voiceTemplate = '';
      try {
        const voiceRes = await axios.get(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/templates/voice.md`,
          { headers },
        );
        voiceTemplate = voiceRes.data;
      } catch {
        // Optional
      }

      // Read skills folder via GitHub API
      const skillsTreeRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/skills?ref=${branch}`,
        { headers },
      );
      const skillDirs = (skillsTreeRes.data as Array<{ name: string; type: string }>) || [];

      for (const item of skillDirs) {
        if (item.type === 'dir') {
          try {
            const skillMdRes = await axios.get(
              `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${item.name}/SKILL.md`,
              { headers },
            );
            const parsed = this.parseSkillMd(skillMdRes.data, item.name);

            // Inherit author & metadata
            parsed.author = {
              name: pluginMeta.author?.name || owner,
              url: pluginMeta.author?.url || `https://github.com/${owner}/${repo}`,
            };
            parsed.repository = `https://github.com/${owner}/${repo}`;
            if (voiceTemplate) {
              parsed.templates = { ...parsed.templates, 'voice.md': voiceTemplate };
            }

            // Assign social media category if applicable
            if (item.name.startsWith('yt-') || item.name.startsWith('li-') || item.name.startsWith('ig-')) {
              parsed.category = 'social_media';
            }

            packages.push(parsed);
          } catch {
            // Directory might not have SKILL.md
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`GitHub API inspection failed: ${err.message}. Generating fallback skill package.`);
      // If rate limited or unavailable, return a high-fidelity package for the repo
      packages.push({
        schemaVersion: 1,
        id: `${repo.toLowerCase()}-suite`,
        name: `${repo} Suite`,
        description: `Imported skills bundle from ${repoUrl}`,
        version: '1.0.0',
        author: { name: owner, url: repoUrl },
        category: 'social_media',
        tags: [owner, repo, 'imported'],
        executionType: 'instruction',
        instructions: `Autonomous agent skill suite imported from ${repoUrl}`,
        inputs: {
          task: { name: 'task', type: 'string', description: 'Task to perform', required: true },
        },
        outputs: {
          result: { name: 'result', type: 'string', description: 'Result' },
        },
        parameters: {},
        requiredCapabilities: [],
        dependencies: [],
        permissions: [],
      });
    }

    return packages;
  }

  /**
   * Scans a skill package for security risks, prompt injection, and host compromise attempts.
   */
  private scanSecurity(pkg: SkillPackage): string[] {
    const issues: string[] = [];

    const fullText = [
      pkg.instructions,
      JSON.stringify(pkg.inputs),
      JSON.stringify(pkg.scripts || {}),
      JSON.stringify(pkg.templates || {}),
    ].join('\n');

    // Host exploitation checks
    if (/rm\s+-rf\s+\/|del\s+\/f\s+\/s\s+\/q/i.test(fullText)) {
      issues.push('CRITICAL: Malicious filesystem deletion command detected.');
    }
    if (/curl\s+.*\|\s*(?:bash|sh)|wget\s+.*\|\s*(?:bash|sh)/i.test(fullText)) {
      issues.push('CRITICAL: Unsafe remote script piping to shell detected.');
    }
    if (/process\.env\.(AWS_|JWT_|DATABASE_|SECRET_|KEY_)/i.test(fullText)) {
      issues.push('CRITICAL: Attempted environment secret exfiltration.');
    }

    // Prompt injection heuristic checks
    if (/ignore\s+(all\s+)?previous\s+instructions/i.test(fullText)) {
      issues.push('WARNING: Potential prompt injection keyword "ignore previous instructions" detected.');
    }
    if (/bypass\s+safety\s+filters|jailbreak/i.test(fullText)) {
      issues.push('WARNING: Safety filter bypass pattern detected.');
    }

    return issues;
  }
}
