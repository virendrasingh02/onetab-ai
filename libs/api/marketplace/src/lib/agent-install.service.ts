import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AISecretsService } from '@org/api-ai';
import { PrismaService, type Prisma } from '@org/database';
import {
  WorkspacePermission,
  isPolicyRoleAllowed,
  type WorkspacePolicy,
  type WorkspaceRole,
} from '@org/types';
import {
  canUseInstall,
  compareSemver,
  evaluateAgentPackage,
  newPermissions,
  parseAccess,
  parseJsonSafe,
  validateConfig,
  type AgentInstallManifest,
  type InstallAccess,
  type PermissionRequest,
} from './agent-manifest.js';
import { MarketplaceService } from './marketplace.service.js';
import type { InstallationView } from './marketplace.types.js';

/** A claim older than this is treated as a crashed worker and may be taken over. */
const LEASE_MS = 2 * 60_000;

export type AgentInstallScope = 'WORKSPACE' | 'PERSONAL' | 'ADMIN_MANAGED';

export interface InstallActor {
  id: string;
  name?: string;
  role?: WorkspaceRole;
  permissions: readonly WorkspacePermission[];
  policies?: WorkspacePolicy;
}

export interface AgentInstallRequest {
  scope?: AgentInstallScope;
  access?: Partial<InstallAccess>;
  settings?: Record<string, unknown>;
  approvedPermissions?: string[];
  reason?: string;
}

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface HealthResult {
  ok: boolean;
  checkedAt: string;
  checks: HealthCheck[];
}

type ListingRow = NonNullable<Awaited<ReturnType<MarketplaceService['requireListing']>>>;
type InstallRow = NonNullable<
  Awaited<ReturnType<AgentInstallService['findInstall']>>
>;

interface Blueprint {
  name?: string;
  role?: string;
  description?: string | null;
  avatarUrl?: string | null;
  systemPrompt: string;
  systemInstructions?: string | null;
  provider: string;
  model: string;
  tools?: string | string[];
  graphJson?: string | null;
  configuration?: Record<string, unknown>;
}

/** Typed, machine-readable failure — the UI branches on `code`, not on the message. */
function fail(status: 400 | 403 | 404 | 409 | 422, code: string, message: string, extra: object = {}): never {
  throw new HttpException({ code, message, ...extra }, status);
}

function isManager(actor: InstallActor) {
  return actor.permissions.includes(WorkspacePermission.MANAGE_SETTINGS);
}

/**
 * The install lifecycle for AGENT listings.
 *
 * Definition (the listing) → installation record (this table row, one per
 * listing per workspace) → runtime (the provisioned `AIAgent`). An install is
 * only `ACTIVE` once the agent exists *and* a health check passed; any failure
 * rolls back what that attempt created and leaves the row `FAILED` with a
 * typed error. Updates never widen granted permissions without a new approval,
 * and a failed update restores the agent from a snapshot.
 */
@Injectable()
export class AgentInstallService {
  private readonly logger = new Logger(AgentInstallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplace: MarketplaceService,
    private readonly secrets: AISecretsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Read side
  // ---------------------------------------------------------------------------

  async findInstall(workspaceId: string, listingId: string) {
    return this.prisma.marketplaceInstallation.findUnique({
      where: { listingId_workspaceId: { listingId, workspaceId } },
      include: { listing: { include: { publisher: PUBLISHER } } },
    });
  }

  private async loadListing(workspaceId: string, slug: string): Promise<ListingRow> {
    const listing = await this.marketplace.requireListing(slug);
    if (listing.kind !== 'AGENT' || !this.marketplace.canSee(listing, workspaceId)) {
      throw new NotFoundException(`Agent '${slug}' not found.`);
    }
    return listing;
  }

  /** A workspace's own Studio agent is already live there — installing it would only clone it onto itself. */
  private isOwnAgent(listing: ListingRow, workspaceId: string) {
    return !!listing.sourceAgentId && listing.ownerWorkspaceId === workspaceId;
  }

  private async requireInstall(workspaceId: string, slug: string) {
    const listing = await this.loadListing(workspaceId, slug);
    const row = await this.findInstall(workspaceId, listing.id);
    if (!row) fail(404, 'NOT_INSTALLED', 'This agent is not installed in the workspace.');
    return { listing, row };
  }

  /** What installing this agent would ask for, and what the caller may do about it. */
  async preview(workspaceId: string, slug: string, actor: InstallActor) {
    const listing = await this.loadListing(workspaceId, slug);
    const evaluated = evaluateAgentPackage(listing.manifestJson, listing.payloadJson);
    const row = await this.findInstall(workspaceId, listing.id);
    const decision = this.decide(actor, evaluated.ok ? evaluated.permissions : [], evaluated.ok ? evaluated.manifest : null);

    const granted = parseJsonSafe<string[]>(row?.approvedPermissions, []);
    const pending = evaluated.ok && row && row.status !== 'UNINSTALLED' ? newPermissions(granted, evaluated.permissions) : [];

    return {
      listing: this.marketplace.toSummary(listing, !!row && row.status !== 'UNINSTALLED'),
      installable: evaluated.ok && listing.status === 'PUBLISHED' && !this.isOwnAgent(listing, workspaceId),
      ownAgent: this.isOwnAgent(listing, workspaceId),
      listingStatus: listing.status,
      issues: evaluated.ok ? [] : evaluated.issues,
      permissions: evaluated.ok ? evaluated.permissions : [],
      configFields: evaluated.ok ? evaluated.manifest.configFields : [],
      dependencies: evaluated.ok ? { connectors: evaluated.manifest.connectors, externalServices: evaluated.manifest.externalServices } : null,
      compatibility: evaluated.ok
        ? { minPlatformVersion: evaluated.manifest.minPlatformVersion, platforms: evaluated.manifest.platforms }
        : null,
      requiresAdminApproval: decision.needsApproval,
      canInstall: decision.allowed,
      forcedScope: decision.forcedScope,
      reason: decision.reason,
      installation: row ? this.marketplace.toInstallation(row) : null,
      newPermissions: pending,
    };
  }

  /** Installed agents this caller may see (managers see all; others only what they can use). */
  async list(workspaceId: string, actor: InstallActor): Promise<InstallationView[]> {
    const rows = await this.prisma.marketplaceInstallation.findMany({
      where: { workspaceId, status: { not: 'UNINSTALLED' }, listing: { kind: 'AGENT' } },
      include: { listing: { include: { publisher: PUBLISHER } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows
      .filter((row) => isManager(actor) || row.installedById === actor.id || canUseInstall(parseAccess(row.accessJson), this.userRef(actor)))
      .map((row) => this.marketplace.toInstallation(row));
  }

  async listAudit(workspaceId: string, take = 100) {
    const rows = await this.prisma.workspaceAuditLog.findMany({
      where: { workspaceId, action: { startsWith: 'agent.' } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      target: r.targetId,
      actor: r.actor ? { id: r.actor.id, name: r.actor.name, email: r.actor.email } : null,
      metadata: r.metadata,
      createdAt: r.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Decisions
  // ---------------------------------------------------------------------------

  private userRef(actor: InstallActor) {
    return { id: actor.id, role: actor.role, isManager: isManager(actor) };
  }

  /**
   * Who may install, and whether it needs an admin's sign-off. Managers install
   * anything; other members may install only when the workspace's "who can
   * install apps" policy allows it, only for themselves, and only for agents
   * that ask for nothing sensitive.
   */
  private decide(actor: InstallActor, permissions: PermissionRequest[], manifest: AgentInstallManifest | null) {
    if (isManager(actor)) {
      return { allowed: true, needsApproval: false, code: null as string | null, forcedScope: null as AgentInstallScope | null, reason: null as string | null };
    }
    const policyAllows =
      actor.permissions.includes(WorkspacePermission.CREATE) &&
      !!actor.policies &&
      isPolicyRoleAllowed(actor.role, actor.policies.whoCanInstallApps);
    if (!policyAllows) {
      return {
        allowed: false,
        needsApproval: true,
        code: 'INSTALL_NOT_PERMITTED',
        forcedScope: null,
        reason: 'Your workspace admin controls who can install agents. You can request access instead.',
      };
    }
    const risky = !!manifest?.requiresAdmin || permissions.some((p) => p.sensitive);
    return {
      allowed: !risky,
      needsApproval: risky,
      code: risky ? 'APPROVAL_REQUIRED' : null,
      forcedScope: 'PERSONAL' as AgentInstallScope,
      reason: risky ? 'This agent asks for sensitive access, so an admin has to approve it.' : null,
    };
  }

  requireManager(actor: InstallActor, what: string) {
    this.assertManager(actor, what);
  }

  private assertManager(actor: InstallActor, what: string) {
    if (!isManager(actor)) fail(403, 'FORBIDDEN', `Only workspace admins can ${what}.`);
  }

  /** Managers, or the member who owns a personal install. */
  private assertCanManage(actor: InstallActor, row: { installedById: string | null; scope: string }) {
    if (isManager(actor)) return;
    if (row.scope === 'PERSONAL' && row.installedById === actor.id) return;
    fail(403, 'FORBIDDEN', 'You cannot manage this installation.');
  }

  // ---------------------------------------------------------------------------
  // Install
  // ---------------------------------------------------------------------------

  async install(workspaceId: string, slug: string, actor: InstallActor, input: AgentInstallRequest) {
    const listing = await this.loadListing(workspaceId, slug);
    if (listing.status !== 'PUBLISHED') {
      fail(409, 'LISTING_UNAVAILABLE', `'${listing.name}' is ${listing.status.toLowerCase()} and cannot be installed.`);
    }
    if (this.isOwnAgent(listing, workspaceId)) {
      fail(409, 'OWN_AGENT', 'This agent was built in this workspace, so it is already available here.');
    }
    const evaluated = this.evaluateOrFail(listing);
    const decision = this.decide(actor, evaluated.permissions, evaluated.manifest);
    if (!decision.allowed) {
      fail(403, decision.code ?? 'INSTALL_NOT_PERMITTED', decision.reason ?? 'Not permitted.');
    }

    const existing = await this.findInstall(workspaceId, listing.id);
    // Idempotent: asking again for something already installed changes nothing.
    if (existing && ['ACTIVE', 'DISABLED'].includes(existing.status) && !existing.lockedAt) {
      return { installation: this.marketplace.toInstallation(existing), alreadyInstalled: true };
    }

    const scope = decision.forcedScope ?? input.scope ?? 'WORKSPACE';
    const access = this.resolveAccess(scope, actor, input.access, decision.forcedScope !== null);
    this.assertApprovals(evaluated.permissions, input.approvedPermissions ?? []);
    const config = this.checkConfig(evaluated.manifest, input.settings ?? {});
    await this.checkDependencies(workspaceId, evaluated.manifest);

    return this.runInstall({
      workspaceId, listing, evaluated, scope, access, config, actor,
      installerId: actor.id,
      approved: this.approvedSet(evaluated.permissions, input.approvedPermissions ?? []),
      from: ['UNINSTALLED', 'FAILED', 'PENDING_APPROVAL', 'INSTALLING'],
    });
  }

  private evaluateOrFail(listing: ListingRow) {
    const evaluated = evaluateAgentPackage(listing.manifestJson, listing.payloadJson);
    if (!evaluated.ok) {
      const code = evaluated.issues.some((i) => i.code === 'INCOMPATIBLE') ? 'INCOMPATIBLE' : 'INVALID_PACKAGE';
      fail(422, code, evaluated.issues[0]?.message ?? 'The agent package is invalid.', { issues: evaluated.issues });
    }
    return evaluated;
  }

  private assertApprovals(permissions: PermissionRequest[], approved: string[]) {
    const missing = permissions.filter((p) => p.sensitive && !approved.includes(p.id));
    if (missing.length) {
      fail(409, 'PERMISSION_APPROVAL_REQUIRED', 'Review and approve the sensitive permissions this agent requests.', {
        permissions: missing,
      });
    }
  }

  private approvedSet(permissions: PermissionRequest[], approved: string[]) {
    // Non-sensitive permissions are implied by installing; sensitive ones must have been named.
    return permissions.filter((p) => !p.sensitive || approved.includes(p.id)).map((p) => p.id);
  }

  private resolveAccess(scope: AgentInstallScope, actor: InstallActor, requested: Partial<InstallAccess> | undefined, forced: boolean): InstallAccess {
    if (scope === 'PERSONAL') return { mode: 'RESTRICTED', userIds: [actor.id], roles: [] };
    if (forced) fail(403, 'FORBIDDEN', 'Members can only install agents for themselves.');
    if (scope === 'ADMIN_MANAGED' && !requested?.mode) return { mode: 'RESTRICTED', userIds: [actor.id], roles: ['OWNER', 'ADMIN'] };
    return {
      mode: requested?.mode === 'RESTRICTED' ? 'RESTRICTED' : 'EVERYONE',
      userIds: [...new Set(requested?.userIds ?? [])].slice(0, 200),
      roles: [...new Set(requested?.roles ?? [])].slice(0, 8),
    };
  }

  private checkConfig(manifest: AgentInstallManifest, values: Record<string, unknown>) {
    const result = validateConfig(manifest.configFields, values);
    if (Object.keys(result.errors).length) {
      fail(400, 'INVALID_CONFIG', 'Some settings need attention.', { fields: result.errors });
    }
    return result;
  }

  private async checkDependencies(workspaceId: string, manifest: AgentInstallManifest) {
    if (!manifest.connectors.length) return;
    const connected = await this.prisma.externalIntegration.findMany({
      where: { workspaceId, provider: { in: manifest.connectors }, status: 'CONNECTED' },
      select: { provider: true },
    });
    const have = new Set(connected.map((c) => c.provider));
    const missing = manifest.connectors.filter((c) => !have.has(c));
    if (missing.length) {
      fail(422, 'MISSING_DEPENDENCY', `Connect ${missing.join(', ')} in Integrations first.`, { missing });
    }
  }

  private secretKey(slug: string, field: string) {
    return `AGENT_${slug}_${field}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
  }

  /** Takes the install lease, or fails with `INSTALL_IN_PROGRESS` if someone else holds it. */
  private async claim(workspaceId: string, listing: ListingRow, installerId: string, from: string[], status: 'INSTALLING' | 'UPDATING') {
    const cutoff = new Date(Date.now() - LEASE_MS);
    const existing = await this.findInstall(workspaceId, listing.id);
    if (!existing) {
      try {
        const created = await this.prisma.marketplaceInstallation.create({
          data: { listingId: listing.id, workspaceId, installedById: installerId, version: listing.version, status, lockedAt: new Date() },
          include: { listing: { include: { publisher: PUBLISHER } } },
        });
        return { row: created, created: true };
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') fail(409, 'INSTALL_IN_PROGRESS', 'Another install of this agent is already running.');
        throw err;
      }
    }
    const claimed = await this.prisma.marketplaceInstallation.updateMany({
      where: { id: existing.id, status: { in: from }, OR: [{ lockedAt: null }, { lockedAt: { lt: cutoff } }] },
      data: { status, lockedAt: new Date(), lastError: null, lastErrorCode: null },
    });
    if (claimed.count === 0) {
      fail(409, 'INSTALL_IN_PROGRESS', 'Another install or update of this agent is already running.');
    }
    return { row: (await this.findInstall(workspaceId, listing.id)) as InstallRow, created: false, previous: existing };
  }

  private async runInstall(ctx: {
    workspaceId: string;
    listing: ListingRow;
    evaluated: Extract<ReturnType<typeof evaluateAgentPackage>, { ok: true }>;
    scope: AgentInstallScope;
    access: InstallAccess;
    config: ReturnType<typeof validateConfig>;
    actor: InstallActor;
    installerId: string;
    approved: string[];
    from: string[];
  }) {
    const { workspaceId, listing, evaluated, config } = ctx;
    const claim = await this.claim(workspaceId, listing, ctx.installerId, ctx.from, 'INSTALLING');
    const wasInstalledBefore = !claim.created && claim.previous?.status === 'UNINSTALLED';
    const createdSecretKeys: string[] = [];
    let createdAgentId: string | null = null;

    try {
      const secretRefs: Record<string, string> = {};
      for (const [field, value] of Object.entries(config.secrets)) {
        const key = this.secretKey(listing.slug, field);
        await this.secrets.createSecret(workspaceId, ctx.installerId, {
          key,
          value,
          description: `Used by installed agent '${listing.name}'`,
        });
        createdSecretKeys.push(key);
        secretRefs[field] = key;
      }

      const reusable = await this.findAgent(workspaceId, listing, claim.row.agentId);
      let agentId: string;
      let version = listing.version;
      let manifestJson = JSON.stringify(evaluated.manifest);
      let approved = ctx.approved;

      if (reusable) {
        // Reinstall after an uninstall that kept the agent: bring it back as it was
        // (its edits and conversations intact) rather than overwriting it.
        await this.prisma.aIAgent.update({ where: { id: reusable.id }, data: { isActive: true } });
        agentId = reusable.id;
        const prior = claim.row;
        if (prior.pinnedManifestJson && prior.pinnedManifestJson !== '{}') {
          version = prior.version;
          manifestJson = prior.pinnedManifestJson;
          approved = [...new Set([...parseJsonSafe<string[]>(prior.approvedPermissions, []), ...ctx.approved])];
        }
      } else {
        const agent = await this.prisma.aIAgent.create({
          data: this.agentCreateData(workspaceId, listing, ctx.installerId, claim.row.id, config.plain, secretRefs),
        });
        agentId = agent.id;
        createdAgentId = agent.id;
      }

      const settings = { ...config.plain, _secretRefs: secretRefs };
      const health = await this.healthFor(workspaceId, listing.slug, agentId, evaluated.manifest, settings);
      if (!health.ok) {
        const first = health.checks.find((c) => !c.ok);
        throw new InstallFailure('HEALTH_CHECK_FAILED', `Health check failed: ${first?.name}${first?.detail ? ` — ${first.detail}` : ''}`);
      }

      const installation = await this.prisma.$transaction(async (tx) => {
        const row = await tx.marketplaceInstallation.update({
          where: { id: claim.row.id },
          data: {
            status: 'ACTIVE', lockedAt: null, version, agentId,
            scope: ctx.scope, accessJson: JSON.stringify(ctx.access),
            settingsJson: JSON.stringify(settings),
            approvedPermissions: JSON.stringify(approved),
            pinnedManifestJson: manifestJson,
            grantedScopes: JSON.stringify(approved),
            healthJson: JSON.stringify(health),
            lastError: null, lastErrorCode: null,
          },
          include: { listing: { include: { publisher: PUBLISHER } } },
        });
        if (claim.created || wasInstalledBefore) {
          await tx.marketplaceListing.update({ where: { id: listing.id }, data: { installCount: { increment: 1 } } });
        }
        await this.audit(tx, workspaceId, ctx.actor.id, 'agent.install.completed', listing.slug, {
          version, scope: ctx.scope, approvedPermissions: approved, installedFor: ctx.installerId,
        });
        return row;
      });
      return { installation: this.marketplace.toInstallation(installation), alreadyInstalled: false };
    } catch (err) {
      await this.cleanupFailedInstall(workspaceId, claim.row.id, createdAgentId, createdSecretKeys);
      const failure = err instanceof InstallFailure ? err : new InstallFailure('INSTALL_FAILED', 'The agent could not be installed.');
      if (!(err instanceof InstallFailure)) this.logger.error(`Install of '${listing.slug}' failed: ${err instanceof Error ? err.stack : String(err)}`);
      await this.prisma.marketplaceInstallation.update({
        where: { id: claim.row.id },
        data: { status: 'FAILED', lockedAt: null, lastError: failure.message, lastErrorCode: failure.code },
      });
      await this.auditSafe(workspaceId, ctx.actor.id, 'agent.install.failed', listing.slug, { code: failure.code, message: failure.message });
      fail(409, failure.code, failure.message, { retryable: true });
    }
  }

  /** Removes only what this attempt created; anything that pre-existed is left alone. */
  private async cleanupFailedInstall(workspaceId: string, installationId: string, agentId: string | null, secretKeys: string[]) {
    try {
      if (agentId) await this.prisma.aIAgent.deleteMany({ where: { id: agentId, workspaceId } });
      for (const key of secretKeys) await this.secrets.deleteSecret(workspaceId, key).catch(() => undefined);
      await this.prisma.marketplaceInstallation.update({ where: { id: installationId }, data: { agentId: null } });
    } catch (err) {
      this.logger.error(`Cleanup after failed install left residue: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Approval flow (members request, admins decide)
  // ---------------------------------------------------------------------------

  async requestApproval(workspaceId: string, slug: string, actor: InstallActor, input: AgentInstallRequest) {
    const listing = await this.loadListing(workspaceId, slug);
    if (listing.status !== 'PUBLISHED') fail(409, 'LISTING_UNAVAILABLE', 'This agent is not available.');
    if (this.isOwnAgent(listing, workspaceId)) fail(409, 'OWN_AGENT', 'This agent was built in this workspace, so it is already available here.');
    const evaluated = this.evaluateOrFail(listing);
    const existing = await this.findInstall(workspaceId, listing.id);
    if (existing && ['ACTIVE', 'DISABLED', 'INSTALLING', 'UPDATING'].includes(existing.status)) {
      fail(409, 'ALREADY_INSTALLED', 'This agent is already installed or being installed.');
    }
    const approvalRequest = {
      requestedBy: actor.id,
      requestedByName: actor.name ?? actor.id,
      reason: (input.reason ?? 'Requested by workspace member').slice(0, 500),
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      scope: isManager(actor) ? (input.scope ?? 'WORKSPACE') : 'PERSONAL',
      permissions: evaluated.permissions.map((p) => p.id),
    };
    const settingsJson = JSON.stringify({ approvalRequest, lastActivityAt: approvalRequest.requestedAt });
    const row = await this.prisma.marketplaceInstallation.upsert({
      where: { listingId_workspaceId: { listingId: listing.id, workspaceId } },
      create: { listingId: listing.id, workspaceId, installedById: actor.id, version: listing.version, status: 'PENDING_APPROVAL', settingsJson },
      update: { status: 'PENDING_APPROVAL', installedById: actor.id, settingsJson, lastError: null, lastErrorCode: null },
      include: { listing: { include: { publisher: PUBLISHER } } },
    });
    await this.auditSafe(workspaceId, actor.id, 'agent.install.requested', listing.slug, { reason: approvalRequest.reason });
    return this.marketplace.toInstallation(row);
  }

  async resolveApproval(
    workspaceId: string,
    slug: string,
    actor: InstallActor,
    input: AgentInstallRequest & { action: 'APPROVE' | 'REJECT'; rejectionReason?: string },
  ) {
    this.assertManager(actor, 'approve agent installs');
    const { listing, row } = await this.requireInstall(workspaceId, slug);
    if (row.status !== 'PENDING_APPROVAL') fail(409, 'NOT_PENDING', 'There is no pending request for this agent.');
    const request = (parseJsonSafe<Record<string, any>>(row.settingsJson, {}).approvalRequest ?? {}) as Record<string, any>;

    if (input.action === 'REJECT') {
      const updated = await this.prisma.marketplaceInstallation.update({
        where: { id: row.id },
        data: {
          status: 'UNINSTALLED',
          settingsJson: JSON.stringify({
            approvalRequest: { ...request, status: 'REJECTED', reviewedBy: actor.id, reviewedAt: new Date().toISOString(), rejectionReason: input.rejectionReason?.slice(0, 500) },
          }),
        },
        include: { listing: { include: { publisher: PUBLISHER } } },
      });
      await this.auditSafe(workspaceId, actor.id, 'agent.install.rejected', slug, { reason: input.rejectionReason });
      return { installation: this.marketplace.toInstallation(updated), alreadyInstalled: false };
    }

    const evaluated = this.evaluateOrFail(listing);
    this.assertApprovals(evaluated.permissions, input.approvedPermissions ?? []);
    const config = this.checkConfig(evaluated.manifest, input.settings ?? {});
    await this.checkDependencies(workspaceId, evaluated.manifest);
    const requesterId: string = request.requestedBy ?? row.installedById ?? actor.id;
    const scope: AgentInstallScope = input.scope ?? (request.scope === 'PERSONAL' ? 'PERSONAL' : 'WORKSPACE');
    const access = scope === 'PERSONAL'
      ? ({ mode: 'RESTRICTED', userIds: [requesterId], roles: [] } as InstallAccess)
      : this.resolveAccess(scope, actor, input.access, false);
    await this.auditSafe(workspaceId, actor.id, 'agent.install.approved', slug, { requestedBy: requesterId, approvedPermissions: input.approvedPermissions ?? [] });
    return this.runInstall({
      workspaceId, listing, evaluated, scope, access, config, actor,
      installerId: requesterId,
      approved: this.approvedSet(evaluated.permissions, input.approvedPermissions ?? []),
      from: ['PENDING_APPROVAL'],
    });
  }

  async listApprovals(workspaceId: string, actor: InstallActor) {
    this.assertManager(actor, 'review agent install requests');
    const rows = await this.prisma.marketplaceInstallation.findMany({
      where: { workspaceId, status: 'PENDING_APPROVAL', listing: { kind: 'AGENT' } },
      include: { listing: { include: { publisher: PUBLISHER } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.marketplace.toInstallation(r));
  }

  // ---------------------------------------------------------------------------
  // Update (with permission diff + rollback)
  // ---------------------------------------------------------------------------

  async update(workspaceId: string, slug: string, actor: InstallActor, input: Pick<AgentInstallRequest, 'approvedPermissions' | 'settings'>) {
    const { listing, row } = await this.requireInstall(workspaceId, slug);
    this.assertCanManage(actor, row);
    if (!['ACTIVE', 'DISABLED'].includes(row.status)) fail(409, 'INVALID_STATE', `A ${row.status.toLowerCase()} installation cannot be updated.`);
    if (compareSemver(listing.version, row.version) <= 0) fail(409, 'NO_UPDATE', 'This agent is already up to date.');
    if (listing.status !== 'PUBLISHED') fail(409, 'LISTING_UNAVAILABLE', 'This agent is no longer published.');

    const evaluated = this.evaluateOrFail(listing);
    const granted = parseJsonSafe<string[]>(row.approvedPermissions, []);
    const added = newPermissions(granted, evaluated.permissions);
    const approvedNow = input.approvedPermissions ?? [];
    const unapproved = added.filter((p) => !approvedNow.includes(p.id));
    if (unapproved.length) {
      fail(409, 'PERMISSION_APPROVAL_REQUIRED', 'This version asks for access the current install does not have.', { permissions: unapproved });
    }
    if (!isManager(actor) && added.some((p) => p.sensitive)) {
      fail(403, 'APPROVAL_REQUIRED', 'An admin has to approve the new sensitive permissions.');
    }

    const existingSettings = parseJsonSafe<Record<string, any>>(row.settingsJson, {});
    const secretRefs: Record<string, string> = { ...(existingSettings._secretRefs ?? {}) };
    const { _secretRefs, ...plainExisting } = existingSettings;
    void _secretRefs;
    const merged = { ...plainExisting, ...(input.settings ?? {}) };
    // Secrets already stored count as supplied; only brand-new required ones must come in.
    const validation = validateConfig(
      evaluated.manifest.configFields.filter((f) => !(f.type === 'secret' && secretRefs[f.key])),
      Object.fromEntries(Object.entries(merged).filter(([k]) => !secretRefs[k])),
    );
    if (Object.keys(validation.errors).length) fail(400, 'INVALID_CONFIG', 'Some settings need attention.', { fields: validation.errors });
    await this.checkDependencies(workspaceId, evaluated.manifest);

    const previousStatus = row.status;
    const claim = await this.claim(workspaceId, listing, actor.id, [previousStatus], 'UPDATING');
    const agent = row.agentId ? await this.prisma.aIAgent.findFirst({ where: { id: row.agentId, workspaceId } }) : null;
    const snapshot = agent ? JSON.stringify(this.snapshotAgent(agent)) : null;
    const newSecretKeys: string[] = [];

    try {
      if (!agent) throw new InstallFailure('AGENT_MISSING', 'The installed agent no longer exists. Reinstall it.');
      for (const [field, value] of Object.entries(validation.secrets)) {
        const key = this.secretKey(listing.slug, field);
        await this.secrets.createSecret(workspaceId, actor.id, { key, value, description: `Used by installed agent '${listing.name}'` });
        secretRefs[field] = key;
        newSecretKeys.push(key);
      }
      const blueprint = parseJsonSafe<{ blueprint?: Blueprint }>(listing.payloadJson, {}).blueprint;
      if (blueprint) {
        const data = this.agentCreateData(workspaceId, listing, agent.creatorId ?? actor.id, row.id, validation.plain, secretRefs);
        // Keep identity and history; replace behaviour.
        await this.prisma.aIAgent.update({
          where: { id: agent.id },
          data: {
            name: data.name, role: data.role, description: data.description, avatarUrl: data.avatarUrl,
            systemPrompt: data.systemPrompt, systemInstructions: data.systemInstructions,
            provider: data.provider, model: data.model, tools: data.tools, graphJson: data.graphJson ?? null,
            configuration: data.configuration,
          },
        });
      }
      const settings = { ...validation.plain, _secretRefs: secretRefs };
      const health = await this.healthFor(workspaceId, listing.slug, agent.id, evaluated.manifest, settings);
      if (!health.ok) throw new InstallFailure('HEALTH_CHECK_FAILED', `Health check failed after update: ${health.checks.find((c) => !c.ok)?.name}`);

      const approved = [...new Set([...granted, ...approvedNow.filter((id) => added.some((p) => p.id === id))])];
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.marketplaceInstallation.update({
          where: { id: row.id },
          data: {
            status: previousStatus, lockedAt: null, version: listing.version,
            settingsJson: JSON.stringify(settings), approvedPermissions: JSON.stringify(approved),
            grantedScopes: JSON.stringify(approved), pinnedManifestJson: JSON.stringify(evaluated.manifest),
            rollbackJson: snapshot, healthJson: JSON.stringify(health), lastError: null, lastErrorCode: null,
          },
          include: { listing: { include: { publisher: PUBLISHER } } },
        });
        await this.audit(tx, workspaceId, actor.id, 'agent.update.completed', slug, {
          from: row.version, to: listing.version, addedPermissions: added.map((p) => p.id),
        });
        return next;
      });
      return { installation: this.marketplace.toInstallation(updated), alreadyInstalled: false };
    } catch (err) {
      const failure = err instanceof InstallFailure ? err : new InstallFailure('UPDATE_FAILED', 'The update could not be applied; the previous version was restored.');
      if (!(err instanceof InstallFailure)) this.logger.error(`Update of '${slug}' failed: ${err instanceof Error ? err.stack : String(err)}`);
      if (agent && snapshot) {
        await this.prisma.aIAgent.update({ where: { id: agent.id }, data: this.restoreData(JSON.parse(snapshot)) }).catch((e) => this.logger.error(`Rollback failed: ${e}`));
      }
      for (const key of newSecretKeys) await this.secrets.deleteSecret(workspaceId, key).catch(() => undefined);
      await this.prisma.marketplaceInstallation.update({
        where: { id: claim.row.id },
        data: { status: previousStatus, lockedAt: null, lastError: failure.message, lastErrorCode: failure.code },
      });
      await this.auditSafe(workspaceId, actor.id, 'agent.update.failed', slug, { code: failure.code, message: failure.message });
      fail(409, failure.code, failure.message, { rolledBack: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Enable / disable / access / uninstall / health
  // ---------------------------------------------------------------------------

  async setEnabled(workspaceId: string, slug: string, actor: InstallActor, enabled: boolean) {
    const { row } = await this.requireInstall(workspaceId, slug);
    this.assertCanManage(actor, row);
    if (!['ACTIVE', 'DISABLED'].includes(row.status)) fail(409, 'INVALID_STATE', `A ${row.status.toLowerCase()} installation cannot be ${enabled ? 'enabled' : 'disabled'}.`);
    if (row.scope === 'ADMIN_MANAGED' && !isManager(actor)) fail(403, 'FORBIDDEN', 'This agent is managed by an administrator.');
    const updated = await this.prisma.$transaction(async (tx) => {
      if (row.agentId) await tx.aIAgent.updateMany({ where: { id: row.agentId, workspaceId }, data: { isActive: enabled } });
      const next = await tx.marketplaceInstallation.update({
        where: { id: row.id },
        data: { status: enabled ? 'ACTIVE' : 'DISABLED' },
        include: { listing: { include: { publisher: PUBLISHER } } },
      });
      await this.audit(tx, workspaceId, actor.id, enabled ? 'agent.enabled' : 'agent.disabled', slug, {});
      return next;
    });
    return this.marketplace.toInstallation(updated);
  }

  async updateAccess(workspaceId: string, slug: string, actor: InstallActor, input: { scope?: AgentInstallScope; access?: Partial<InstallAccess> }) {
    this.assertManager(actor, 'change who can use an installed agent');
    const { row } = await this.requireInstall(workspaceId, slug);
    const scope = input.scope ?? (row.scope as AgentInstallScope);
    const access = scope === 'PERSONAL'
      ? ({ mode: 'RESTRICTED', userIds: [row.installedById ?? actor.id], roles: [] } as InstallAccess)
      : this.resolveAccess(scope, actor, input.access ?? parseAccess(row.accessJson), false);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.marketplaceInstallation.update({
        where: { id: row.id },
        data: { scope, accessJson: JSON.stringify(access) },
        include: { listing: { include: { publisher: PUBLISHER } } },
      });
      await this.audit(tx, workspaceId, actor.id, 'agent.access.changed', slug, { scope, access });
      return next;
    });
    return this.marketplace.toInstallation(updated);
  }

  /**
   * Default keeps the agent (deactivated), its conversations and stored
   * settings so a reinstall restores them. `purge` deletes the agent, its
   * history and the secrets this install stored — the caller must confirm.
   */
  async uninstall(workspaceId: string, slug: string, actor: InstallActor, opts: { purge?: boolean; confirm?: boolean }) {
    const { listing, row } = await this.requireInstall(workspaceId, slug);
    this.assertCanManage(actor, row);
    if (row.status === 'UNINSTALLED') return { listingSlug: slug, workspaceId, status: 'UNINSTALLED' as const, purged: false };
    if (['INSTALLING', 'UPDATING'].includes(row.status) && row.lockedAt && row.lockedAt.getTime() > Date.now() - LEASE_MS) {
      fail(409, 'INSTALL_IN_PROGRESS', 'Wait for the running install or update to finish.');
    }
    if (opts.purge && !opts.confirm) {
      fail(400, 'CONFIRMATION_REQUIRED', 'Removing this agent permanently deletes its conversations and stored credentials. Confirm to continue.');
    }
    const settings = parseJsonSafe<Record<string, any>>(row.settingsJson, {});
    await this.prisma.$transaction(async (tx) => {
      if (row.agentId) {
        if (opts.purge) await tx.aIAgent.deleteMany({ where: { id: row.agentId, workspaceId } });
        else await tx.aIAgent.updateMany({ where: { id: row.agentId, workspaceId }, data: { isActive: false } });
      }
      await tx.marketplaceInstallation.update({
        where: { id: row.id },
        data: { status: 'UNINSTALLED', lockedAt: null, ...(opts.purge ? { agentId: null, settingsJson: '{}', pinnedManifestJson: '{}', approvedPermissions: '[]' } : {}) },
      });
      if (row.status !== 'PENDING_APPROVAL' && row.status !== 'FAILED') {
        await tx.marketplaceListing.update({ where: { id: listing.id }, data: { installCount: { decrement: listing.installCount > 0 ? 1 : 0 } } });
      }
      await this.audit(tx, workspaceId, actor.id, opts.purge ? 'agent.purged' : 'agent.uninstalled', slug, { version: row.version });
    });
    if (opts.purge) {
      for (const key of Object.values<string>(settings._secretRefs ?? {})) {
        await this.secrets.deleteSecret(workspaceId, key).catch(() => undefined);
      }
    }
    return { listingSlug: slug, workspaceId, status: 'UNINSTALLED' as const, purged: !!opts.purge };
  }

  async checkHealth(workspaceId: string, slug: string, actor: InstallActor) {
    const { listing, row } = await this.requireInstall(workspaceId, slug);
    this.assertCanManage(actor, row);
    const manifest = parseJsonSafe<AgentInstallManifest | null>(row.pinnedManifestJson, null);
    const settings = parseJsonSafe<Record<string, unknown>>(row.settingsJson, {});
    const health = await this.healthFor(workspaceId, listing.slug, row.agentId, manifest && manifest.tools ? manifest : null, settings);
    await this.prisma.marketplaceInstallation.update({ where: { id: row.id }, data: { healthJson: JSON.stringify(health) } });
    return health;
  }

  /**
   * Server-side gate the agent runtime calls before every turn: is this
   * installed agent active, and may `requesterId` use it? A run with no
   * requester (a schedule or workflow) is gated on status alone. Agents that
   * were not installed from the marketplace are untouched.
   */
  async assertCanRun(workspaceId: string, agentId: string, requesterId?: string | null) {
    const row = await this.prisma.marketplaceInstallation.findFirst({
      where: { workspaceId, agentId, listing: { kind: 'AGENT' } },
      select: { status: true, accessJson: true },
    });
    if (!row) return;
    if (row.status !== 'ACTIVE') fail(409, 'AGENT_UNAVAILABLE', 'This agent is not currently active.');
    if (!requesterId) return;
    const access = parseAccess(row.accessJson);
    if (access.mode === 'EVERYONE') return;
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId, status: 'ACTIVE' },
      select: { role: true },
    });
    const manager = member?.role === 'OWNER' || member?.role === 'ADMIN';
    if (!member || !canUseInstall(access, { id: requesterId, role: member.role, isManager: manager })) {
      fail(403, 'AGENT_ACCESS_DENIED', 'You do not have access to this agent.');
    }
  }

  /** Agent ids this member must not see: restricted installs they are not on the list for. */
  async hiddenAgentIds(workspaceId: string, userId: string, role: WorkspaceRole | undefined): Promise<Set<string>> {
    const rows = await this.prisma.marketplaceInstallation.findMany({
      where: { workspaceId, agentId: { not: null }, listing: { kind: 'AGENT' } },
      select: { agentId: true, accessJson: true, status: true },
    });
    const manager = role === 'OWNER' || role === 'ADMIN';
    const hidden = new Set<string>();
    for (const r of rows) {
      if (r.agentId && !canUseInstall(parseAccess(r.accessJson), { id: userId, role, isManager: manager })) hidden.add(r.agentId);
    }
    return hidden;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async findAgent(workspaceId: string, listing: ListingRow, agentId: string | null) {
    if (agentId) {
      const byId = await this.prisma.aIAgent.findFirst({ where: { id: agentId, workspaceId } });
      if (byId) return byId;
    }
    return this.prisma.aIAgent.findFirst({
      where: { workspaceId, configuration: { path: ['marketplace', 'listingSlug'], equals: listing.slug } },
    });
  }

  private agentCreateData(
    workspaceId: string, listing: ListingRow, userId: string, installationId: string,
    config: Record<string, unknown>, secretRefs: Record<string, string>,
  ) {
    const blueprint = parseJsonSafe<{ blueprint?: Blueprint }>(listing.payloadJson, {}).blueprint;
    const now = new Date().toISOString();
    const marketplace = { listingSlug: listing.slug, version: listing.version, installationId };
    const install = { installConfig: config, installSecretRefs: secretRefs };
    const tools = blueprint?.tools === undefined ? undefined : typeof blueprint.tools === 'string' ? blueprint.tools : JSON.stringify(blueprint.tools);
    return {
      workspaceId,
      creatorId: userId,
      type: 'agent',
      name: blueprint?.name || listing.name,
      role: blueprint?.role || listing.category,
      description: blueprint?.description || listing.tagline || listing.description,
      avatarUrl: blueprint?.avatarUrl ?? listing.iconUrl,
      systemPrompt: blueprint?.systemPrompt ?? `You are ${listing.name}, an autonomous ${listing.category} assistant.`,
      systemInstructions: blueprint?.systemInstructions ?? '',
      ...(blueprint ? { provider: blueprint.provider, model: blueprint.model } : {}),
      ...(tools === undefined ? {} : { tools }),
      graphJson: blueprint?.graphJson ?? null,
      isMarketplace: true,
      isActive: true,
      configuration: {
        ...(blueprint?.configuration ?? {}),
        status: 'published',
        currentVersion: 1,
        publishedAt: now,
        versions: [{
          version: 1, versionTag: `v${listing.version}`, name: blueprint?.name || listing.name,
          description: blueprint?.description ?? null, model: blueprint?.model, provider: blueprint?.provider,
          graphJson: blueprint?.graphJson ?? null, tools, publishedAt: now,
          changeSummary: `Installed from marketplace (${listing.slug} v${listing.version})`, status: 'PUBLISHED',
        }],
        marketplace,
        ...install,
      } as Prisma.InputJsonObject,
    };
  }

  private snapshotAgent(agent: Record<string, any>) {
    const keys = ['name', 'role', 'description', 'avatarUrl', 'systemPrompt', 'systemInstructions', 'provider', 'model', 'tools', 'graphJson', 'configuration', 'isActive'];
    return Object.fromEntries(keys.map((k) => [k, agent[k] ?? null]));
  }

  private restoreData(snapshot: Record<string, any>) {
    const { configuration, ...rest } = snapshot;
    return { ...rest, configuration: configuration ?? {} };
  }

  private async healthFor(
    workspaceId: string, slug: string, agentId: string | null,
    manifest: AgentInstallManifest | null, settings: Record<string, unknown>,
  ): Promise<HealthResult> {
    const checks: HealthCheck[] = [];
    const agent = agentId ? await this.prisma.aIAgent.findFirst({ where: { id: agentId, workspaceId } }) : null;
    checks.push({ name: 'Agent exists', ok: !!agent, detail: agent ? undefined : 'The provisioned agent is missing.' });
    if (agent) {
      checks.push({ name: 'Model configured', ok: !!agent.provider && !!agent.model, detail: `${agent.provider}/${agent.model}` });
      checks.push({ name: 'Prompt present', ok: agent.systemPrompt.trim().length > 0 });
      if (agent.graphJson) {
        checks.push({ name: 'Workflow graph valid', ok: parseJsonSafe<unknown>(agent.graphJson, null) !== null });
      }
    }
    const refs = (settings['_secretRefs'] ?? {}) as Record<string, string>;
    for (const field of manifest?.configFields.filter((f) => f.type === 'secret') ?? []) {
      const key = refs[field.key];
      const present = key ? (await this.secrets.getDecryptedSecret(workspaceId, key).catch(() => null)) !== null : false;
      if (key || field.required) checks.push({ name: `Credential '${field.label}'`, ok: present || !field.required, detail: present ? undefined : 'Not stored.' });
    }
    if (manifest?.connectors.length) {
      const connected = await this.prisma.externalIntegration.count({ where: { workspaceId, provider: { in: manifest.connectors }, status: 'CONNECTED' } });
      checks.push({ name: 'Connections available', ok: connected >= manifest.connectors.length, detail: manifest.connectors.join(', ') });
    }
    void slug;
    return { ok: checks.every((c) => c.ok), checkedAt: new Date().toISOString(), checks };
  }

  /** For events outside a transaction (failures, requests): a lost audit row is logged, never allowed to mask the outcome. */
  private async auditSafe(workspaceId: string, actorId: string | null, action: string, slug: string, metadata: Record<string, unknown>) {
    await this.audit(this.prisma, workspaceId, actorId, action, slug, metadata).catch((err) =>
      this.logger.error(`Audit write failed for ${action}: ${err instanceof Error ? err.message : String(err)}`),
    );
  }

  /** Written inside the caller's transaction, so a state change and its audit row commit together. */
  private async audit(
    db: Pick<PrismaService, 'workspaceAuditLog'>, workspaceId: string, actorId: string | null,
    action: string, slug: string, metadata: Record<string, unknown>,
  ) {
    await db.workspaceAuditLog.create({
      data: { workspaceId, actorId, action, targetType: 'agent_install', targetId: slug, metadata: metadata as object },
    });
  }
}

class InstallFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const PUBLISHER = {
  select: { name: true, slug: true, isVerified: true, websiteUrl: true, supportEmail: true },
} as const;
