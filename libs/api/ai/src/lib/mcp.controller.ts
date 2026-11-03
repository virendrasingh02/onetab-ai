import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  Public,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type {
  CreateMCPConnectionInput,
  UpdateMCPConnectionInput,
} from '@org/types';
import {
  createMCPConnectionSchema,
  testMcpToolSchema,
  updateMCPConnectionSchema,
} from '@org/validation';
import type { Response } from 'express';
import { MCPService, type MCPOAuthOutcome } from './mcp.service.js';

@Controller({ path: 'workspaces/:workspaceId/mcp-connections', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class MCPController {
  constructor(private readonly mcpService: MCPService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.mcpService.listConnections(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createMCPConnectionSchema)) body: CreateMCPConnectionInput,
  ) {
    return this.mcpService.createConnection(workspaceId, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  delete(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.mcpService.deleteConnection(workspaceId, id);
  }

  @Patch(':id')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(updateMCPConnectionSchema)) body: UpdateMCPConnectionInput,
  ) {
    return this.mcpService.updateConnection(workspaceId, id, body);
  }

  @Post(':id/tools/test')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  testTool(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(testMcpToolSchema))
    body: { toolName: string; params: Record<string, unknown> },
  ) {
    return this.mcpService.testTool(
      workspaceId,
      id,
      body.toolName,
      body.params,
    );
  }

  @Post(':id/sync')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  sync(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.mcpService.syncTools(workspaceId, id);
  }

  /** Starts the MCP OAuth sign-in; the Studio opens the returned URL in a popup. */
  @Post(':id/oauth/start')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  startOAuth(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.mcpService.startOAuth(workspaceId, id);
  }

  @Post(':id/oauth/sign-out')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  signOutOAuth(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.mcpService.signOutOAuth(workspaceId, id);
  }
}

/**
 * Where an MCP server's authorization server returns the member. Public: the
 * one-use state (connection id + random nonce, checked against the stored
 * one) is what ties it to the sign-in a workspace admin started.
 */
@Controller({ path: 'mcp-oauth', version: '1' })
export class MCPOAuthCallbackController {
  constructor(private readonly mcpService: MCPService) {}

  @Public()
  @Get('callback')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async callback(
    @Query()
    query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const pick = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const outcome = await this.mcpService.completeOAuth({
      state: pick(query['state']),
      code: pick(query['code']),
      error: pick(query['error']),
      error_description: pick(query['error_description']),
    });
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'",
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(outcome.ok ? 200 : 400).send(callbackPage(outcome));
  }
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/** Tells the Studio popup opener how it went, then closes itself. */
function callbackPage(outcome: MCPOAuthOutcome): string {
  // JSON inside a script: escape `<` so a message can't close the tag.
  const payload = JSON.stringify({
    type: 'MCP_OAUTH_RESULT',
    ok: outcome.ok,
    message: outcome.message,
  }).replace(/</g, '\\u003c');
  const title = outcome.ok ? 'Connected' : 'Sign-in failed';
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
    <div style="max-width: 28rem; text-align: center; padding: 2rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155;">
      <h2 style="margin: 0 0 0.5rem; color: ${outcome.ok ? '#22c55e' : '#f87171'};">${title}</h2>
      <p style="color: #94a3b8; font-size: 0.875rem;">${escapeHtml(outcome.message)}</p>
      <p style="color: #64748b; font-size: 0.75rem; margin-top: 1rem;">You can close this window.</p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage(${payload}, '*');
        ${outcome.ok ? 'setTimeout(function () { window.close(); }, 1200);' : ''}
      }
    </script>
  </body>
</html>`;
}
