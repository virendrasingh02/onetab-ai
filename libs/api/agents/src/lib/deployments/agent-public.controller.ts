import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public, zodBody } from '@org/api-common';
import { UnsupportedDocumentError, extractTextFromFile } from '@org/api-ai';
import {
  initAgentSessionSchema,
  sendSessionMessageSchema,
  executeHeadlessAgentSchema,
  type InitAgentSessionInput,
  type SendSessionMessageInput,
  type ExecuteHeadlessAgentInput,
} from '@org/validation';
import { AgentDeploymentService } from './agent-deployment.service.js';
import { AgentSessionService } from './agent-session.service.js';
import { AgentRuntimeBridgeService } from './agent-runtime-bridge.service.js';

/** The largest file a widget visitor may upload. */
const MAX_WIDGET_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Whether a deployment's widget lets visitors attach files (on unless turned off). */
export function widgetAllowsAttachments(widgetConfig: unknown): boolean {
  return (widgetConfig as { behavior?: { allowAttachments?: unknown } } | null)?.behavior?.allowAttachments !== false;
}

/**
 * The surface an embed, a website visitor or a customer's backend calls. It is
 * exempt from the platform's login guard (those callers have no platform
 * account), so every handler authenticates itself: a deployment public key to
 * start a session, the session token afterwards, or a workspace API key.
 */
@Public()
@Controller({ version: '1' })
export class AgentPublicController {
  constructor(
    private readonly deploymentService: AgentDeploymentService,
    private readonly sessionService: AgentSessionService,
    private readonly runtimeBridge: AgentRuntimeBridgeService,
  ) {}

  /** The bearer value of an `Authorization` header, if any. */
  private bearer(authHeader?: string): string | null {
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  }

  /** The session behind a request, only for a caller holding that session's own token. */
  private async requireSession(sessionId: string, sessionTokenHeader?: string, authHeader?: string) {
    const token = sessionTokenHeader || this.bearer(authHeader);
    if (!token || !token.startsWith('ot_sess_')) {
      throw new UnauthorizedException('A session token is required.');
    }
    const session = await this.sessionService.getSessionByToken(token);
    if (session.id !== sessionId) throw new ForbiddenException('Session token mismatch.');
    return session;
  }

  /** The workspace a workspace API key belongs to. */
  private async requireApiKeyWorkspace(apiKeyHeader?: string, authHeader?: string): Promise<string> {
    const key = apiKeyHeader || this.bearer(authHeader);
    const record = key ? await this.deploymentService.validateApiKey(key) : null;
    if (!record) throw new UnauthorizedException('A valid API key is required.');
    return record.workspaceId;
  }

  // --- 1. SESSIONS ---

  @Post('agent-sessions')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async initSession(
    @Headers('origin') origin: string | undefined,
    @Headers('host') host: string | undefined,
    @Body(zodBody(initAgentSessionSchema)) body: InitAgentSessionInput,
  ) {
    // Inside our own iframe embed the browser's Origin is this API, not the site
    // framing it; the embed page reports the framing site instead.
    let effectiveOrigin = origin;
    if (body.embedOrigin) {
      try {
        if (!origin || new URL(origin).host === host) effectiveOrigin = body.embedOrigin;
      } catch {
        /* a malformed Origin keeps its own value */
      }
    }
    return this.sessionService.initSession(body.publicKey, body.userContext, effectiveOrigin, {
      visitorKey: body.visitorKey,
      resumeSessionId: body.resumeSessionId,
    });
  }

  @Get('agent-sessions/:sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const session = await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    return {
      id: session.id,
      deploymentId: session.deploymentId,
      agentId: session.agentId,
      agentName: session.deployment.agent.name,
      status: session.status,
      title: session.title,
      expiresAt: session.expiresAt.toISOString(),
      messagesCount: Array.isArray(session.messages) ? session.messages.length : 0,
    };
  }

  @Post('agent-sessions/:sessionId/messages')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async sendSessionMessage(
    @Param('sessionId') sessionId: string,
    @Headers('authorization') authHeader: string | undefined,
    @Headers('x-session-token') sessionTokenHeader: string | undefined,
    @Body(zodBody(sendSessionMessageSchema)) body: SendSessionMessageInput,
  ) {
    const session = await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    const attachments = body.attachmentIds.length
      ? this.sessionService.resolveAttachments(session, body.attachmentIds)
      : [];

    return this.runtimeBridge.execute({
      workspaceId: session.deployment.workspaceId,
      agentId: session.agentId,
      deploymentId: session.deploymentId,
      sessionId: session.id,
      prompt: body.message.trim(),
      context: body.context,
      attachments,
    });
  }

  /**
   * A file for the next message. Its text is read here (PDF, DOCX, text,
   * CSV, or an image through OCR) and kept on the session; the reply names
   * the attachment to send with `attachmentIds`.
   */
  @Post('agent-sessions/:sessionId/attachments')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_WIDGET_UPLOAD_BYTES, files: 1 } }))
  async uploadAttachment(
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer; size: number } | undefined,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const session = await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    if (!widgetAllowsAttachments(session.deployment.widgetConfig)) {
      throw new ForbiddenException('This assistant does not accept files.');
    }
    if (!file) throw new BadRequestException('Attach a file in the "file" field.');
    // Browsers send the name as latin1 bytes; recover the UTF-8 the visitor sees.
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    try {
      const { text, mimeType } = await extractTextFromFile(file.buffer, name);
      return await this.sessionService.addAttachment(session, { name, mimeType, size: file.size, text });
    } catch (err) {
      if (err instanceof UnsupportedDocumentError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  // --- 1b. CONVERSATIONS (a visitor's history on one deployment) ---

  @Get('agent-sessions/:sessionId/conversations')
  async listConversations(
    @Param('sessionId') sessionId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const session = await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    return this.sessionService.listConversations(session);
  }

  @Post('agent-sessions/:sessionId/conversations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async createConversation(
    @Param('sessionId') sessionId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const session = await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    return this.sessionService.createConversation(session);
  }

  @Post('agent-sessions/:sessionId/conversations/:conversationId/open')
  async openConversation(
    @Param('sessionId') sessionId: string,
    @Param('conversationId') conversationId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const session = await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    return this.sessionService.openConversation(session, conversationId);
  }

  @Delete('agent-sessions/:sessionId/conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @Param('sessionId') sessionId: string,
    @Param('conversationId') conversationId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const session = await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    await this.sessionService.deleteConversation(session, conversationId);
  }

  @Get('agent-sessions/:sessionId/messages')
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    return this.sessionService.getMessages(sessionId);
  }

  @Post('agent-sessions/:sessionId/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetSession(
    @Param('sessionId') sessionId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.requireSession(sessionId, sessionTokenHeader, authHeader);
    await this.sessionService.resetSession(sessionId);
  }

  // --- 2. HEADLESS EXECUTION ---

  @Post('agents/:agentId/execute')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async executeAgent(
    @Param('agentId') agentId: string,
    @Headers('authorization') authHeader: string | undefined,
    @Headers('x-public-key') publicKeyHeader: string | undefined,
    @Headers('x-api-key') apiKeyHeader: string | undefined,
    @Body(zodBody(executeHeadlessAgentSchema)) body: ExecuteHeadlessAgentInput,
  ) {
    const prompt =
      body.prompt ||
      body.message ||
      (typeof body.input === 'string' ? body.input : JSON.stringify(body.input || {})) ||
      '';

    if (!prompt) {
      throw new BadRequestException('A prompt or message is required.');
    }

    // Authenticate:
    // Option A: Private API Key (ot_live_...)
    const apiKey =
      apiKeyHeader ||
      (authHeader?.startsWith('Bearer ot_live_')
        ? authHeader.slice(7)
        : authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null);

    if (apiKey) {
      const keyRecord = await this.deploymentService.validateApiKey(apiKey);
      if (!keyRecord) {
        throw new UnauthorizedException('Invalid or expired API key.');
      }

      return this.runtimeBridge.execute({
        workspaceId: keyRecord.workspaceId,
        agentId,
        prompt,
        context: body.context,
        versionNumber: body.versionNumber,
      });
    }

    // Option B: Public Key (ot_pub_...)
    const publicKey = publicKeyHeader || (authHeader?.startsWith('Bearer ot_pub_') ? authHeader.slice(7) : null);
    if (publicKey) {
      const deployment = await this.deploymentService.getDeploymentByPublicKey(publicKey);
      if (deployment.agentId !== agentId) {
        throw new ForbiddenException('Public key does not match the requested agent.');
      }

      return this.runtimeBridge.execute({
        workspaceId: deployment.workspaceId,
        agentId,
        deploymentId: deployment.id,
        prompt,
        context: body.context,
        versionNumber: deployment.versionNumber,
      });
    }

    throw new UnauthorizedException(
      'Authentication required. Provide an API key (Bearer ot_live_...) or public key (x-public-key: ot_pub_...).',
    );
  }

  // --- 3. RUN MANAGEMENT & APPROVALS ---

  @Get('agent-runs/:runId')
  async getRun(
    @Param('runId') runId: string,
    @Headers('x-api-key') apiKeyHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const workspaceId = await this.requireApiKeyWorkspace(apiKeyHeader, authHeader);

    const live = this.runtimeBridge.getRunState(runId, workspaceId);
    if (live) return live;

    const execution = await this.runtimeBridge.findExecution(runId, workspaceId);
    if (!execution) throw new NotFoundException('Run not found.');
    return {
      runId: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      latencyMs: execution.latencyMs,
      tokensUsed: execution.tokensUsed,
      toolCalls: execution.toolCalls,
    };
  }

  @Post('agent-runs/:runId/cancel')
  async cancelRun(
    @Param('runId') runId: string,
    @Headers('x-api-key') apiKeyHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const workspaceId = await this.requireApiKeyWorkspace(apiKeyHeader, authHeader);
    const cancelled = await this.runtimeBridge.cancelRun(runId, workspaceId);
    if (!cancelled) throw new NotFoundException('No running run with that id.');
    return { success: true, runId };
  }

  // --- 4. BROWSER SDK & EMBED ASSETS ---

  @Get('deployments/sdk/agent-widget.js')
  getWidgetSdk(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.send(BROWSER_WIDGET_SDK_SCRIPT);
  }

  @Get('deployments/sdk/agent-embed.html')
  getEmbedHtml(
    @Query('agentId') agentId: string,
    @Query('publicKey') publicKey: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    // These come straight off the URL and end up inside HTML attributes, so
    // anything that is not a plain identifier is refused rather than escaped.
    if (!IDENTIFIER.test(agentId ?? '') || !IDENTIFIER.test(publicKey ?? '')) {
      throw new BadRequestException('agentId and publicKey must be plain identifiers.');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    // The one API document meant to render, inside a customer's iframe: the
    // global deny-all CSP and frame guard would leave it blank. Sessions are
    // still origin-checked by the API itself.
    res.setHeader('Content-Security-Policy', EMBED_PAGE_CSP);
    res.removeHeader('X-Frame-Options');
    res.send(generateEmbedHtmlPage(agentId, publicKey, theme === 'light' ? 'light' : 'dark'));
  }
}

/** Ids and keys are letters, digits, `_` and `-`. */
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

/** Its own SDK and API calls, inline styles, and avatar images; framable anywhere. */
const EMBED_PAGE_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "style-src 'unsafe-inline'",
  'img-src https: http: data:',
  "base-uri 'none'",
  "form-action 'none'",
  'frame-ancestors *',
].join('; ');

// Standalone, framework-independent browser SDK packaged inline
const BROWSER_WIDGET_SDK_SCRIPT = `
(function () {
  'use strict';

  // A module script has no currentScript, so fall back to finding this file's own tag.
  var SELF = document.currentScript || document.querySelector('script[src*="deployments/sdk/agent-widget.js"]');
  var SCRIPT_SRC = SELF && SELF.src ? SELF.src : '';
  // The API root (with its version prefix) is wherever this file was served from.
  var API_BASE = SCRIPT_SRC
    ? SCRIPT_SRC.split(/[?#]/)[0].replace(/\\/deployments\\/sdk\\/agent-widget\\.js$/, '')
    : window.location.origin + '/api/v1';
  // Inside our own iframe embed the browser reports the API as the origin, so pass the framing page along.
  var EMBED_ORIGIN = '';
  try {
    if (window.parent !== window) {
      EMBED_ORIGIN = (window.location.ancestorOrigins && window.location.ancestorOrigins[0]) ||
        (document.referrer ? new URL(document.referrer).origin : '');
    }
  } catch (e) {}
  // Shown when the agent has no avatar image (the Studio preview draws the same glyph).
  var BOT_ICON = '<svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>';

  function initWidget() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.querySelectorAll('script[data-agent-id]');
      script = scripts[scripts.length - 1];
    }
    if (!script || !script.hasAttribute('data-agent-id')) return;

    var agentId = script.getAttribute('data-agent-id');
    var publicKey = script.getAttribute('data-public-key');
    var mode = script.getAttribute('data-mode') || 'floating';
    var theme = script.getAttribute('data-theme') || 'system';

    if (!agentId || !publicKey) {
      console.warn('[Onetab Agent Widget] Missing data-agent-id or data-public-key.');
      return;
    }

    createAgentWidget({
      agentId: agentId,
      publicKey: publicKey,
      mode: mode,
      theme: theme,
      baseUrl: API_BASE,
      // An inline widget fills its container, or renders where its script tag sits.
      container: mode === 'inline'
        ? document.getElementById(script.getAttribute('data-container') || 'onetab-agent-container')
        : null,
      anchor: script,
    });
  }

  // Lucide paths, the same icons the Studio preview draws.
  var P_CLOSE = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
  var P_EXPAND = '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>';
  var P_ARROW = '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>';
  var P_EXTERNAL = '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>';
  var P_CHAT = '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>';
  var P_HISTORY = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>';
  var P_NEW = '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>';
  var P_CLIP = '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>';
  var P_FILE = '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>';
  var P_TRASH = '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>';
  var P_BACK = '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>';
  var P_ALERT = '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>';

  // What the file picker offers and the API reads text from; one message carries up to five, 10 MB each.
  var ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.log,.png,.jpg,.jpeg,.bmp';
  var MAX_FILES = 5;
  var MAX_FILE_BYTES = 10 * 1024 * 1024;

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {}
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
    return new Date(iso).toLocaleDateString();
  }

  function svg(paths, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  function str(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  /** http(s) links only; anything else is dropped. */
  function safeLink(value) {
    try {
      var url = new URL(str(value));
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  function createAgentWidget(options) {
    var containerId = 'onetab-agent-widget-' + options.agentId;
    if (document.getElementById(containerId)) return;
    var inline = options.mode === 'inline';

    var host = document.createElement('div');
    host.id = containerId;
    if (inline) host.style.height = '100%';
    if (inline && options.container) options.container.appendChild(host);
    else if (inline && options.anchor && options.anchor.parentNode) options.anchor.parentNode.insertBefore(host, options.anchor.nextSibling);
    else document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = getWidgetStyles();
    shadow.appendChild(style);

    // The deployment's brand colour lives in its own sheet, set once the session reply arrives.
    var brandStyle = document.createElement('style');
    shadow.appendChild(brandStyle);

    var root = document.createElement('div');
    shadow.appendChild(root);

    var state = {
      ready: inline,
      view: inline ? 'open' : 'closed', // closed | compact | open
      sessionId: null,
      sessionToken: null,
      messages: [],
      isLoading: false,
      draft: '',
      dark: false,
      layout: 'panel',
      title: 'AI Assistant',
      subtitle: '',
      brand: null,
      position: 'bottom-right',
      suggestions: [],
      avatarUrl: null,
      placeholder: '',
      launcherLabel: '',
      disclaimer: '',
      privacyUrl: null,
      allowAttachments: true,
      attachments: [], // { localId, name, size, status: uploading | ready | error, error, attachment }
      historyOpen: false,
      historyLoading: false,
      historyError: '',
      conversations: null,
    };

    // This browser's visitor key and last conversation, so a reload picks up where it was.
    var visitorStoreKey = 'ot_agent_visitor_' + options.publicKey;
    var sessionStoreKey = 'ot_agent_session_' + options.publicKey;
    // Bumped on every conversation switch, so a late reply or upload from the old one is dropped.
    var epoch = 0;

    function resolveTheme(configTheme) {
      var pick = configTheme === 'light' || configTheme === 'dark' ? configTheme
        : options.theme === 'light' || options.theme === 'dark' ? options.theme
        : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      state.dark = pick === 'dark';
    }
    resolveTheme(null);

    var dismissKey = 'ot_agent_dismissed_' + options.agentId;
    function wasDismissed() {
      try { return sessionStorage.getItem(dismissKey) === '1'; } catch (e) { return false; }
    }

    function applyConfig(dep) {
      var a = (dep.widgetConfig && dep.widgetConfig.appearance) || {};
      state.title = str(a.title) || dep.agentName || state.title;
      state.subtitle = str(a.subtitle) || dep.agentRole || '';
      // Vetted by the server; relative paths are served by this API.
      try {
        state.avatarUrl = dep.avatarUrl ? new URL(dep.avatarUrl, options.baseUrl).href : null;
      } catch (e) { state.avatarUrl = null; }
      // Only a plain hex colour is ever put into CSS.
      state.brand = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(a.primaryColor || '') ? a.primaryColor : null;
      state.position = a.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
      state.layout = a.layout === 'compact' || a.layout === 'pill' ? a.layout : 'panel';
      state.placeholder = str(a.inputPlaceholder);
      state.launcherLabel = str(a.launcherLabel);
      state.disclaimer = str(a.disclaimer);
      state.privacyUrl = safeLink(a.privacyPolicyUrl);
      state.suggestions = Array.isArray(a.suggestedPrompts)
        ? a.suggestedPrompts.filter(function (p) { return typeof p === 'string' && p.trim(); }).slice(0, 6)
        : [];
      state.allowAttachments = !(dep.widgetConfig && dep.widgetConfig.behavior && dep.widgetConfig.behavior.allowAttachments === false);
      resolveTheme(a.theme);
      brandStyle.textContent = state.brand ? '.ot-root { --ot-brand: ' + state.brand + '; }' : '';
      if (!inline && state.view === 'closed' && state.layout === 'compact' && !wasDismissed()) state.view = 'compact';
    }

    render();

    var storedVisitor = lsGet(visitorStoreKey);
    fetch(options.baseUrl + '/agent-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: options.publicKey,
        embedOrigin: EMBED_ORIGIN || undefined,
        visitorKey: storedVisitor || undefined,
        resumeSessionId: (storedVisitor && lsGet(sessionStoreKey)) || undefined,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.ready = true;
        if (!data.sessionId) {
          render();
          return;
        }
        useSession(data);
        if (data.visitorKey) lsSet(visitorStoreKey, data.visitorKey);
        if (data.deployment) applyConfig(data.deployment);
        render();
        loadMessages();
      })
      .catch(function (err) {
        state.ready = true;
        render();
        console.error('[Onetab Agent Widget] Session initialization failed:', err);
      });

    function useSession(handle) {
      state.sessionId = handle.sessionId;
      state.sessionToken = handle.sessionToken;
      lsSet(sessionStoreKey, handle.sessionId);
    }

    /** A call on the current session; resolves with the parsed body, rejects with the API's message. */
    function api(path, init) {
      init = init || {};
      var headers = init.headers || {};
      headers['x-session-token'] = state.sessionToken;
      init.headers = headers;
      return fetch(options.baseUrl + '/agent-sessions/' + state.sessionId + path, init).then(function (res) {
        if (res.status === 204) return null;
        return res.json().catch(function () { return null; }).then(function (body) {
          if (!res.ok) throw new Error((body && body.message && String(body.message)) || 'Request failed (' + res.status + ').');
          return body;
        });
      });
    }

    function loadMessages() {
      if (!state.sessionId) return;
      var mine = epoch;
      api('/messages').then(function (msgs) {
        if (mine === epoch && Array.isArray(msgs)) {
          state.messages = msgs;
          render();
        }
      }).catch(function () {});
    }

    function clearConversation() {
      epoch++;
      state.messages = [];
      state.attachments = [];
      state.isLoading = false;
    }

    function hasSpoken() {
      return state.messages.some(function (m) { return m.role === 'user'; });
    }

    function newChat() {
      state.historyOpen = false;
      // An untouched conversation is already a new one.
      if (!state.sessionId || !hasSpoken()) { render(); focusInput(); return; }
      clearConversation();
      state.isLoading = true;
      var mine = epoch;
      render();
      api('/conversations', { method: 'POST' })
        .then(function (handle) {
          if (mine !== epoch) return;
          useSession(handle);
          state.isLoading = false;
          loadMessages();
          render();
          focusInput();
        })
        .catch(function () {
          if (mine !== epoch) return;
          state.isLoading = false;
          pushAssistant('A new conversation could not be started. Please try again.');
          render();
        });
    }

    function toggleHistory() {
      state.historyOpen = !state.historyOpen;
      render();
      if (state.historyOpen) loadHistory();
    }

    function loadHistory() {
      if (!state.sessionId) return;
      state.historyLoading = true;
      state.historyError = '';
      render();
      api('/conversations')
        .then(function (list) {
          state.conversations = Array.isArray(list) ? list : [];
          state.historyLoading = false;
          render();
        })
        .catch(function (err) {
          state.historyLoading = false;
          state.historyError = err.message || 'Conversations could not be loaded.';
          render();
        });
    }

    function openConversation(id) {
      state.historyOpen = false;
      if (id === state.sessionId) { render(); return; }
      clearConversation();
      state.isLoading = true;
      var mine = epoch;
      render();
      api('/conversations/' + encodeURIComponent(id) + '/open', { method: 'POST' })
        .then(function (handle) {
          if (mine !== epoch) return;
          useSession(handle);
          state.isLoading = false;
          loadMessages();
        })
        .catch(function (err) {
          if (mine !== epoch) return;
          state.isLoading = false;
          pushAssistant(err.message || 'That conversation could not be opened.');
          render();
        });
    }

    function deleteConversation(id) {
      var wasCurrent = id === state.sessionId;
      state.conversations = (state.conversations || []).filter(function (c) { return c.id !== id; });
      render();
      api('/conversations/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () {
          if (!wasCurrent) return;
          // The open conversation is gone: start a fresh one for this visitor.
          clearConversation();
          return fetch(options.baseUrl + '/agent-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey: options.publicKey, embedOrigin: EMBED_ORIGIN || undefined, visitorKey: lsGet(visitorStoreKey) || undefined }),
          })
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (data.sessionId) useSession(data);
              loadMessages();
              loadHistory();
            });
        })
        .catch(function (err) {
          state.historyError = err.message || 'That conversation could not be deleted.';
          loadHistory();
        });
    }

    function attachFiles(fileList) {
      if (!state.sessionId) return;
      var files = Array.prototype.slice.call(fileList, 0, Math.max(0, MAX_FILES - state.attachments.length));
      var mine = epoch;
      files.forEach(function (file, i) {
        var item = { localId: 'f_' + Date.now() + '_' + i, name: file.name, size: file.size, status: 'uploading', error: '', attachment: null };
        state.attachments.push(item);
        if (file.size > MAX_FILE_BYTES) {
          item.status = 'error';
          item.error = 'Larger than 10 MB';
          return;
        }
        var form = new FormData();
        form.append('file', file);
        api('/attachments', { method: 'POST', body: form })
          .then(function (uploaded) {
            item.status = 'ready';
            item.attachment = uploaded;
            if (mine === epoch) render();
          })
          .catch(function (err) {
            item.status = 'error';
            item.error = err.message || 'Upload failed';
            if (mine === epoch) render();
          });
      });
      render();
      focusInput();
    }

    function removeAttachment(localId) {
      state.attachments = state.attachments.filter(function (a) { return a.localId !== localId; });
      render();
    }

    function readyAttachments() {
      return state.attachments.filter(function (a) { return a.status === 'ready' && a.attachment; }).map(function (a) { return a.attachment; });
    }

    function uploading() {
      return state.attachments.some(function (a) { return a.status === 'uploading'; });
    }

    function pushAssistant(content, extra) {
      var msg = { id: 'msg_' + Date.now(), role: 'assistant', content: content, timestamp: new Date().toISOString() };
      if (extra) for (var k in extra) msg[k] = extra[k];
      state.messages.push(msg);
    }

    function sendMessage(text) {
      var cleanText = str(text);
      var files = readyAttachments();
      if ((!cleanText && !files.length) || state.isLoading || uploading()) return;
      state.historyOpen = false;
      state.attachments = [];
      state.messages.push({ id: 'temp_' + Date.now(), role: 'user', content: cleanText, attachments: files, timestamp: new Date().toISOString() });
      if (!state.sessionId) {
        pushAssistant('The assistant is not available right now. Please try again later.');
        render();
        return;
      }
      state.isLoading = true;
      var mine = epoch;
      render();

      fetch(options.baseUrl + '/agent-sessions/' + state.sessionId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.sessionToken },
        body: JSON.stringify({ message: cleanText, attachmentIds: files.map(function (f) { return f.id; }) }),
      })
        .then(function (res) { return res.json(); })
        .then(function (resData) {
          if (mine !== epoch) return;
          state.conversations = null;
          state.isLoading = false;
          if (resData.output) {
            pushAssistant(resData.output, { id: resData.runId || ('msg_' + Date.now()), awaitingApproval: resData.awaitingApproval });
          } else {
            pushAssistant(resData.error || resData.message || 'The assistant finished without a reply.');
          }
          render();
        })
        .catch(function () {
          if (mine !== epoch) return;
          state.isLoading = false;
          pushAssistant('Connection error. Please try again.');
          render();
        });
    }

    function setView(view) {
      state.view = view;
      if (view === 'closed' && state.layout === 'compact') {
        try { sessionStorage.setItem(dismissKey, '1'); } catch (e) {}
      }
      render();
      if (view !== 'closed') focusInput();
    }

    function focusInput() {
      var input = root.querySelector('.ot-input');
      if (input) input.focus();
    }

    /* ------------------------------- building ------------------------------- */

    function el(tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      return node;
    }

    function iconButton(cls, icon, label, onClick) {
      var button = el('button', cls);
      button.type = 'button';
      button.innerHTML = icon;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.onclick = onClick;
      return button;
    }

    function fillAvatar(node, fallback) {
      node.innerHTML = fallback || BOT_ICON;
      if (!state.avatarUrl) return;
      var img = document.createElement('img');
      img.alt = '';
      img.src = state.avatarUrl;
      img.onerror = function () { node.innerHTML = fallback || BOT_ICON; };
      node.innerHTML = '';
      node.appendChild(img);
    }

    function buildHeader() {
      var header = el('div', 'ot-header');
      var avatar = el('div', 'ot-avatar');
      fillAvatar(avatar);
      header.appendChild(avatar);
      var info = el('div', 'ot-info');
      info.appendChild(el('div', 'ot-title', state.title));
      if (state.subtitle) info.appendChild(el('div', 'ot-subtitle', state.subtitle));
      header.appendChild(info);
      return header;
    }

    function fileChip(name, meta, status, onRemove) {
      var chip = el('div', 'ot-file' + (status === 'error' ? ' ot-file-error' : ''));
      var icon = el('span', 'ot-file-icon' + (status === 'uploading' ? ' ot-spin' : ''));
      icon.innerHTML = status === 'error' ? svg(P_ALERT, 14) : status === 'uploading' ? '<span class="ot-spinner"></span>' : svg(P_FILE, 14);
      chip.appendChild(icon);
      var text = el('span', 'ot-file-text');
      text.appendChild(el('span', 'ot-file-name', name));
      text.appendChild(el('span', 'ot-file-meta', meta));
      chip.appendChild(text);
      if (onRemove) chip.appendChild(iconButton('ot-file-remove', svg(P_CLOSE, 12), 'Remove ' + name, onRemove));
      return chip;
    }

    function buildComposer() {
      var box = el('div', 'ot-composer');
      function canSend(text) {
        return (!!str(text) || readyAttachments().length > 0) && !state.isLoading && !uploading();
      }
      if (state.attachments.length) {
        var files = el('div', 'ot-files');
        state.attachments.forEach(function (a) {
          var meta = a.status === 'error' ? (a.error || 'Upload failed') : a.status === 'uploading' ? 'Uploading…' : formatSize(a.size);
          files.appendChild(fileChip(a.name, meta, a.status, function () { removeAttachment(a.localId); }));
        });
        box.appendChild(files);
      }
      var row = el('div', 'ot-composer-row');
      if (state.allowAttachments) {
        var picker = el('input');
        picker.type = 'file';
        picker.multiple = true;
        picker.accept = ACCEPT;
        picker.style.display = 'none';
        picker.onchange = function () {
          if (picker.files && picker.files.length) attachFiles(picker.files);
        };
        var clip = iconButton('ot-attach', svg(P_CLIP, 16), 'Attach files', function () { picker.click(); });
        clip.disabled = !state.sessionId || state.attachments.length >= MAX_FILES;
        row.appendChild(clip);
        row.appendChild(picker);
        box.ondragover = function (e) { e.preventDefault(); };
        box.ondrop = function (e) {
          e.preventDefault();
          if (e.dataTransfer && e.dataTransfer.files.length) attachFiles(e.dataTransfer.files);
        };
      } else {
        row.classList.add('ot-no-attach');
      }
      var input = el('input', 'ot-input');
      input.type = 'text';
      input.value = state.draft;
      input.placeholder = state.placeholder || 'Ask ' + state.title + ' a question';
      input.setAttribute('aria-label', 'Message');
      var send = iconButton('ot-send', svg(P_ARROW, 16), 'Send', null);
      send.disabled = !canSend(state.draft);
      function submit() {
        var text = state.draft;
        if (!canSend(text)) return;
        state.draft = '';
        if (state.view === 'compact') state.view = 'open';
        sendMessage(text);
        focusInput();
      }
      input.oninput = function () {
        state.draft = input.value;
        send.disabled = !canSend(input.value);
      };
      input.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      };
      send.onclick = submit;
      row.appendChild(input);
      row.appendChild(send);
      box.appendChild(row);
      return box;
    }

    function buildDisclaimer() {
      if (!state.disclaimer && !state.privacyUrl) return null;
      var p = el('p', 'ot-disclaimer', state.disclaimer ? state.disclaimer + ' ' : '');
      if (state.privacyUrl) {
        var link = el('a', null, 'Privacy Policy');
        link.href = state.privacyUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.insertAdjacentHTML('beforeend', svg(P_EXTERNAL, 11));
        p.appendChild(link);
      }
      return p;
    }

    function buildMessages() {
      var list = el('div', 'ot-messages');
      list.setAttribute('aria-live', 'polite');
      for (var i = 0; i < state.messages.length; i++) {
        var m = state.messages[i];
        if (m.role === 'user' && m.attachments && m.attachments.length) {
          var sent = el('div', 'ot-files ot-files-sent');
          m.attachments.forEach(function (a) { sent.appendChild(fileChip(a.name, formatSize(a.size), 'ready', null)); });
          list.appendChild(sent);
          if (!m.content) continue;
        }
        var msg = el('div', 'ot-msg ' + (m.role === 'user' ? 'ot-user' : 'ot-bot'));
        msg.innerHTML = renderMarkdown(m.content);
        if (m.awaitingApproval) {
          var box = el('div', 'ot-approval-box');
          box.appendChild(el('div', 'ot-approval-title', 'Waiting for approval'));
          box.appendChild(el('div', 'ot-approval-desc', m.awaitingApproval.description || ''));
          box.appendChild(el('div', 'ot-approval-desc', 'A person on the team has to approve this before it goes ahead.'));
          msg.appendChild(box);
        }
        list.appendChild(msg);
      }
      if (state.isLoading) {
        var typing = el('div', 'ot-msg ot-bot ot-typing');
        typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        list.appendChild(typing);
      }
      setTimeout(function () { list.scrollTop = list.scrollHeight; }, 30);
      return list;
    }

    function buildChips() {
      var visitorSpoke = state.messages.some(function (m) { return m.role === 'user'; });
      if (!state.suggestions.length || visitorSpoke) return null;
      var chips = el('div', 'ot-chips');
      state.suggestions.forEach(function (text) {
        var chip = el('button', 'ot-chip', text);
        chip.type = 'button';
        chip.onclick = function () { sendMessage(text); };
        chips.appendChild(chip);
      });
      return chips;
    }

    function buildHistory() {
      var wrap = el('div', 'ot-history');
      var bar = el('div', 'ot-history-bar');
      var back = el('button', 'ot-link');
      back.type = 'button';
      back.innerHTML = svg(P_BACK, 14);
      back.appendChild(el('span', null, 'Back'));
      back.onclick = toggleHistory;
      bar.appendChild(back);
      bar.appendChild(el('span', 'ot-history-title', 'Conversations'));
      var fresh = el('button', 'ot-link ot-link-brand');
      fresh.type = 'button';
      fresh.innerHTML = svg(P_NEW, 14);
      fresh.appendChild(el('span', null, 'New'));
      fresh.onclick = newChat;
      bar.appendChild(fresh);
      wrap.appendChild(bar);

      var body = el('div', 'ot-history-list');
      if (state.historyError) body.appendChild(el('p', 'ot-history-error', state.historyError));
      // The untouched conversation the visitor is in isn't worth listing.
      var items = (state.conversations || []).filter(function (c) { return !(c.current && c.title === 'New conversation'); });
      if (state.historyLoading && !items.length) {
        for (var i = 0; i < 3; i++) body.appendChild(el('div', 'ot-skeleton'));
      } else if (!items.length) {
        body.appendChild(el('p', 'ot-history-empty', 'No conversations yet. Ask something and it will show up here.'));
      } else {
        var ul = el('ul');
        ul.setAttribute('aria-label', 'Conversations');
        items.forEach(function (c) {
          var li = el('li', 'ot-history-item' + (c.current ? ' ot-current' : ''));
          var open = el('button', 'ot-history-open');
          open.type = 'button';
          if (c.current) open.setAttribute('aria-current', 'true');
          open.appendChild(el('span', 'ot-history-name', c.title));
          open.appendChild(el('span', 'ot-history-time', (c.current ? 'Current · ' : '') + timeAgo(c.updatedAt)));
          open.onclick = function () { openConversation(c.id); };
          li.appendChild(open);
          li.appendChild(iconButton('ot-history-delete', svg(P_TRASH, 14), 'Delete ' + c.title, function () { deleteConversation(c.id); }));
          ul.appendChild(li);
        });
        body.appendChild(ul);
      }
      wrap.appendChild(body);
      return wrap;
    }

    function buildPanel() {
      var card = el('div', 'ot-card ot-panel');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', 'Chat with ' + state.title);
      var header = buildHeader();
      var historyBtn = iconButton('ot-icon-btn' + (state.historyOpen ? ' ot-active' : ''), svg(P_HISTORY, 17), state.historyOpen ? 'Back to chat' : 'Conversation history', toggleHistory);
      historyBtn.setAttribute('aria-pressed', state.historyOpen ? 'true' : 'false');
      historyBtn.disabled = !state.sessionId;
      header.appendChild(historyBtn);
      var newBtn = iconButton('ot-icon-btn', svg(P_NEW, 17), 'New chat', newChat);
      newBtn.disabled = !state.sessionId || (!hasSpoken() && !state.historyOpen);
      header.appendChild(newBtn);
      if (!inline) header.appendChild(iconButton('ot-icon-btn', svg(P_CLOSE, 18), 'Close chat', function () { setView('closed'); }));
      card.appendChild(header);
      card.appendChild(state.historyOpen ? buildHistory() : buildMessages());
      var chips = state.historyOpen ? null : buildChips();
      if (chips) card.appendChild(chips);
      card.appendChild(buildComposer());
      var note = buildDisclaimer();
      if (note) card.appendChild(note);
      else card.classList.add('ot-no-note');
      return card;
    }

    function buildCompact() {
      var card = el('div', 'ot-card ot-compact');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', 'Chat with ' + state.title);
      var tools = el('div', 'ot-compact-tools');
      tools.appendChild(iconButton('ot-icon-btn', svg(P_EXPAND, 13), 'Expand chat', function () { setView('open'); }));
      tools.appendChild(iconButton('ot-icon-btn', svg(P_CLOSE, 13), 'Dismiss', function () { setView('closed'); }));
      card.appendChild(tools);
      card.appendChild(buildHeader());
      card.appendChild(buildComposer());
      var note = buildDisclaimer();
      if (note) card.appendChild(note);
      return card;
    }

    function buildLauncher() {
      if (state.layout === 'pill') {
        var pill = el('button', 'ot-pill');
        pill.type = 'button';
        var avatar = el('span', 'ot-avatar ot-avatar-sm');
        fillAvatar(avatar);
        pill.appendChild(avatar);
        pill.appendChild(el('span', null, state.launcherLabel || 'Chat with ' + state.title));
        pill.onclick = function () { setView('open'); };
        return pill;
      }
      var button = el('button', 'ot-launcher');
      button.type = 'button';
      button.setAttribute('aria-label', 'Chat with ' + state.title);
      if (state.avatarUrl) fillAvatar(button, svg(P_CHAT, 24));
      else button.innerHTML = svg(P_CHAT, 24);
      button.onclick = function () { setView('open'); };
      return button;
    }

    function render() {
      var hadFocus = shadow.activeElement && shadow.activeElement.className === 'ot-input';
      root.innerHTML = '';
      root.className = 'ot-root' + (state.dark ? ' ot-dark' : '') + (inline ? ' ot-inline-root' : '') + (state.position === 'bottom-left' ? ' ot-left' : '');
      if (!state.ready) return;
      if (inline || state.view === 'open') root.appendChild(buildPanel());
      else if (state.view === 'compact') root.appendChild(buildCompact());
      else root.appendChild(buildLauncher());
      if (hadFocus) focusInput();
    }
  }

  function renderMarkdown(str) {
    if (!str) return '';
    var safe = escapeHtml(str);
    safe = safe.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
    safe = safe.replace(new RegExp('\\x60\\x60\\x60([\\\\s\\\\S]*?)\\x60\\x60\\x60', 'g'), '<pre><code>$1</code></pre>');
    safe = safe.replace(new RegExp('\\x60([^\\x60]+)\\x60', 'g'), '<code>$1</code>');
    safe = safe.replace(/\\n/g, '<br/>');
    return safe;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.innerText = text || '';
    return div.innerHTML;
  }

  // Mirrors the Studio preview (widget-preview.tsx): change one, change the other.
  function getWidgetStyles() {
    return [
      ':host { all: initial; display: block; }',
      '.ot-root { --ot-brand: #6366f1; --ot-bg: #ffffff; --ot-fg: #1f2937; --ot-muted: #6b7280; --ot-soft: #f3f4f6; --ot-line: #e5e7eb; --ot-shadow: 0 12px 40px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06);',
      '  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; display: flex; flex-direction: column; align-items: flex-end;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: var(--ot-fg); }',
      '.ot-root *, .ot-root *::before, .ot-root *::after { box-sizing: border-box; }',
      '.ot-root.ot-left { right: auto; left: 20px; align-items: flex-start; }',
      '.ot-root.ot-dark { --ot-bg: #16181d; --ot-fg: #e5e7eb; --ot-muted: #9ca3af; --ot-soft: #262a33; --ot-line: #2c313b; --ot-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3); }',
      '.ot-root.ot-inline-root { position: relative; right: auto; bottom: auto; left: auto; width: 100%; height: 100%; }',
      '.ot-root button { font: inherit; }',
      '.ot-card { position: relative; background: var(--ot-bg); color: var(--ot-fg); border: 1px solid var(--ot-line); border-radius: 16px; box-shadow: var(--ot-shadow); animation: otIn 0.18s ease-out; }',
      '.ot-panel { width: 400px; height: min(640px, calc(100vh - 40px)); display: flex; flex-direction: column; overflow: hidden; }',
      '.ot-inline-root .ot-panel { width: 100%; height: 100%; border: 0; border-radius: 0; box-shadow: none; animation: none; }',
      '.ot-compact { width: 320px; padding: 20px 14px 14px; }',
      '@keyframes otIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }',
      '.ot-header { display: flex; align-items: center; gap: 12px; padding: 18px 16px 10px 20px; }',
      '.ot-compact .ot-header { padding: 0 2px 14px; }',
      '.ot-avatar { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--ot-brand); color: #fff; }',
      '.ot-avatar-sm { width: 36px; height: 36px; }',
      '.ot-avatar img, .ot-launcher img { width: 100%; height: 100%; object-fit: cover; display: block; }',
      '.ot-info { flex: 1; min-width: 0; }',
      '.ot-title { font-size: 15px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.ot-subtitle { font-size: 13px; line-height: 1.3; color: var(--ot-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.ot-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--ot-fg); cursor: pointer; }',
      '.ot-icon-btn:hover { background: var(--ot-soft); }',
      '.ot-compact-tools { position: absolute; top: -13px; right: 12px; display: flex; gap: 2px; padding: 2px 4px; background: var(--ot-bg); border: 1px solid var(--ot-line); border-radius: 999px; }',
      '.ot-compact-tools .ot-icon-btn { width: 22px; height: 22px; border-radius: 999px; color: var(--ot-muted); }',
      '.ot-messages { flex: 1; overflow-y: auto; padding: 10px 20px 16px; display: flex; flex-direction: column; gap: 18px; }',
      '.ot-msg { font-size: 15px; line-height: 1.55; word-break: break-word; }',
      '.ot-user { align-self: flex-end; max-width: 80%; padding: 10px 14px; border-radius: 12px; background: var(--ot-soft); }',
      '.ot-msg pre { margin: 6px 0; padding: 8px 10px; white-space: pre-wrap; border-radius: 8px; background: var(--ot-soft); font-size: 12.5px; }',
      '.ot-typing { display: flex; gap: 4px; padding: 6px 0; }',
      '.ot-typing .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ot-muted); animation: otBlink 1.4s infinite both; }',
      '.ot-typing .dot:nth-child(2) { animation-delay: 0.2s; }',
      '.ot-typing .dot:nth-child(3) { animation-delay: 0.4s; }',
      '@keyframes otBlink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }',
      '.ot-approval-box { margin-top: 10px; padding: 10px; border: 1px solid rgba(245,158,11,0.4); border-radius: 8px; background: rgba(245,158,11,0.12); font-size: 12px; }',
      '.ot-approval-title { margin-bottom: 4px; font-weight: 600; color: #d97706; }',
      '.ot-approval-desc { margin-bottom: 4px; color: var(--ot-muted); }',
      '.ot-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 20px 10px; }',
      '.ot-chip { padding: 5px 10px; border: 0; border-radius: 999px; font-size: 13px; line-height: 1.3; cursor: pointer; color: var(--ot-brand); background: color-mix(in srgb, var(--ot-brand) 12%, transparent); }',
      '.ot-chip:hover { background: color-mix(in srgb, var(--ot-brand) 20%, transparent); }',
      '.ot-dark .ot-chip { color: color-mix(in srgb, var(--ot-brand) 55%, #fff); background: color-mix(in srgb, var(--ot-brand) 22%, transparent); }',
      '.ot-icon-btn:disabled { opacity: 0.4; cursor: default; background: transparent; }',
      '.ot-icon-btn.ot-active { background: var(--ot-soft); }',
      '.ot-composer { margin: 0 20px; border: 1.5px solid var(--ot-line); border-radius: 10px; background: var(--ot-bg); transition: border-color 0.15s; }',
      '.ot-composer-row { display: flex; align-items: center; gap: 8px; padding: 6px; }',
      '.ot-composer-row.ot-no-attach { padding-left: 14px; }',
      '.ot-attach { width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--ot-muted); cursor: pointer; }',
      '.ot-attach:hover { background: var(--ot-soft); }',
      '.ot-attach:disabled { opacity: 0.4; cursor: default; background: transparent; }',
      '.ot-files { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 8px 0; }',
      '.ot-files-sent { align-self: flex-end; justify-content: flex-end; max-width: 80%; padding: 0; margin-bottom: -10px; }',
      '.ot-file { display: flex; align-items: center; gap: 8px; max-width: 220px; padding: 6px 6px 6px 8px; border: 1px solid var(--ot-line); border-radius: 8px; background: var(--ot-bg); }',
      '.ot-file-error { border-color: rgba(239,68,68,0.5); }',
      '.ot-file-icon { width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; color: var(--ot-brand); background: color-mix(in srgb, var(--ot-brand) 18%, transparent); }',
      '.ot-file-error .ot-file-icon { color: #ef4444; }',
      '.ot-spinner { width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: otSpin 0.8s linear infinite; }',
      '@keyframes otSpin { to { transform: rotate(360deg); } }',
      '.ot-file-text { min-width: 0; flex: 1; display: flex; flex-direction: column; }',
      '.ot-file-name { font-size: 12px; font-weight: 500; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.ot-file-meta { font-size: 11px; line-height: 1.3; color: var(--ot-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.ot-file-error .ot-file-meta { color: #ef4444; }',
      '.ot-file-remove { width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--ot-muted); cursor: pointer; }',
      '.ot-file-remove:hover { background: var(--ot-soft); }',
      '.ot-history { flex: 1; min-height: 0; display: flex; flex-direction: column; }',
      '.ot-history-bar { display: flex; align-items: center; gap: 8px; padding: 4px 20px 8px; }',
      '.ot-history-title { flex: 1; text-align: center; font-size: 13px; font-weight: 600; }',
      '.ot-link { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: var(--ot-muted); font-size: 12px; font-weight: 500; cursor: pointer; }',
      '.ot-link:hover { text-decoration: underline; }',
      '.ot-link-brand { color: var(--ot-brand); }',
      '.ot-dark .ot-link-brand { color: color-mix(in srgb, var(--ot-brand) 55%, #fff); }',
      '.ot-history-list { flex: 1; overflow-y: auto; padding: 0 12px 12px; }',
      '.ot-history-list ul { list-style: none; margin: 0; padding: 0; }',
      '.ot-history-item { position: relative; }',
      '.ot-history-open { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 36px 8px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--ot-fg); text-align: left; cursor: pointer; }',
      '.ot-history-open:hover, .ot-current .ot-history-open { background: var(--ot-soft); }',
      '.ot-history-name { width: 100%; font-size: 13.5px; font-weight: 500; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.ot-history-time { font-size: 11.5px; color: var(--ot-muted); }',
      '.ot-history-delete { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--ot-muted); cursor: pointer; opacity: 0; transition: opacity 0.15s; }',
      '.ot-history-item:hover .ot-history-delete, .ot-history-delete:focus-visible { opacity: 1; }',
      '.ot-history-delete:hover { background: var(--ot-bg); color: #ef4444; }',
      '.ot-history-empty { margin: 40px 24px; text-align: center; font-size: 13px; color: var(--ot-muted); }',
      '.ot-history-error { margin: 4px 8px 8px; font-size: 12px; color: #ef4444; }',
      '.ot-skeleton { height: 44px; margin: 4px 8px 8px; border-radius: 8px; background: var(--ot-soft); animation: otBlink 1.4s infinite both; }',
      '@media (hover: none) { .ot-history-delete { opacity: 1; } }',
      '.ot-panel .ot-composer, .ot-composer:focus-within { border-color: var(--ot-brand); }',
      '.ot-compact .ot-composer { margin: 0; }',
      '.ot-no-note .ot-composer { margin-bottom: 16px; }',
      '.ot-input { flex: 1; min-width: 0; padding: 7px 0; border: 0; outline: 0; background: transparent; color: var(--ot-fg); font: inherit; font-size: 15px; }',
      '.ot-input::placeholder { color: var(--ot-muted); }',
      '.ot-send { width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%; background: var(--ot-brand); color: #fff; cursor: pointer; transition: background 0.15s; }',
      '.ot-send:disabled { background: var(--ot-soft); color: var(--ot-muted); cursor: default; }',
      '.ot-disclaimer { margin: 10px 20px 16px; font-size: 11.5px; line-height: 1.5; text-align: center; color: var(--ot-muted); }',
      '.ot-compact .ot-disclaimer { margin: 10px 4px 0; }',
      '.ot-disclaimer a { display: inline-flex; align-items: center; gap: 3px; color: inherit; text-decoration: underline; }',
      '.ot-launcher { width: 56px; height: 56px; padding: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: var(--ot-brand); color: #fff; box-shadow: var(--ot-shadow); cursor: pointer; transition: transform 0.15s; }',
      '.ot-pill { display: flex; align-items: center; gap: 10px; padding: 6px 20px 6px 6px; border: 1px solid var(--ot-line); border-radius: 999px; background: var(--ot-bg); color: var(--ot-fg); box-shadow: var(--ot-shadow); font-size: 15px; font-weight: 500; cursor: pointer; transition: transform 0.15s; }',
      '.ot-launcher:hover, .ot-pill:hover { transform: translateY(-1px); }',
      '.ot-root button:focus-visible, .ot-disclaimer a:focus-visible { outline: 2px solid var(--ot-brand); outline-offset: 2px; }',
      '@media (max-width: 480px) { .ot-root:not(.ot-inline-root) { left: 12px; right: 12px; bottom: 12px; } .ot-panel { width: 100%; height: calc(100vh - 24px); } .ot-compact { width: 100%; } }',
      '@media (prefers-reduced-motion: reduce) { .ot-card { animation: none; } .ot-launcher, .ot-pill { transition: none; } }',
    ].join(' ');
  }

  // Web Component Registration
  if (typeof customElements !== 'undefined' && !customElements.get('onetab-agent')) {
    var OneTabAgentElement = function () {
      return Reflect.construct(HTMLElement, [], OneTabAgentElement);
    };
    Object.setPrototypeOf(OneTabAgentElement.prototype, HTMLElement.prototype);
    Object.setPrototypeOf(OneTabAgentElement, HTMLElement);

    OneTabAgentElement.prototype.connectedCallback = function () {
      var agentId = this.getAttribute('agent-id');
      var publicKey = this.getAttribute('public-key');
      var mode = this.getAttribute('mode') || 'inline';
      var theme = this.getAttribute('theme') || 'system';
      if (agentId && publicKey) {
        createAgentWidget({
          agentId: agentId,
          publicKey: publicKey,
          mode: mode,
          theme: theme,
          baseUrl: API_BASE,
          container: this,
        });
      }
    };
    customElements.define('onetab-agent', OneTabAgentElement);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
`;

function generateEmbedHtmlPage(agentId: string, publicKey: string, theme = 'dark'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Onetab AI Agent</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${theme === 'light' ? '#ffffff' : '#16181d'}; }
    .embed-container { width: 100%; height: 100%; display: flex; flex-direction: column; }
  </style>
</head>
<body>
  <div class="embed-container" id="widget-root">
    <script
      src="agent-widget.js"
      data-agent-id="${agentId}"
      data-public-key="${publicKey}"
      data-mode="inline"
      data-theme="${theme}"
    ></script>
  </div>
</body>
</html>`;
}
