import {
  BadRequestException,
  Body,
  Controller,
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
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public, zodBody } from '@org/api-common';
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
    @Body(zodBody(initAgentSessionSchema)) body: InitAgentSessionInput,
  ) {
    return this.sessionService.initSession(
      body.publicKey,
      body.userContext,
      origin,
    );
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

    return this.runtimeBridge.execute({
      workspaceId: session.deployment.workspaceId,
      agentId: session.agentId,
      deploymentId: session.deploymentId,
      sessionId: session.id,
      prompt: body.message,
      context: body.context,
    });
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
    res.setHeader('Cache-Control', 'public, max-age=3600');
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
    res.send(generateEmbedHtmlPage(agentId, publicKey, theme === 'light' ? 'light' : 'dark'));
  }
}

/** Ids and keys are letters, digits, `_` and `-`. */
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

// Standalone, framework-independent browser SDK packaged inline
const BROWSER_WIDGET_SDK_SCRIPT = `
(function () {
  'use strict';

  var SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  var BASE_URL = SCRIPT_SRC ? new URL(SCRIPT_SRC).origin : window.location.origin;

  function initWidget() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.querySelectorAll('script[data-agent-id]');
      script = scripts[scripts.length - 1];
    }
    if (!script) return;

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
      baseUrl: BASE_URL,
    });
  }

  function createAgentWidget(options) {
    var containerId = 'onetab-agent-widget-' + options.agentId;
    if (document.getElementById(containerId)) return;

    var host = document.createElement('div');
    host.id = containerId;
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = getWidgetStyles(options);
    shadow.appendChild(style);

    // Branding from the deployment (colour, position) lives in its own sheet,
    // so it can be applied once the session reply arrives.
    var brandStyle = document.createElement('style');
    shadow.appendChild(brandStyle);

    var wrapper = document.createElement('div');
    shadow.appendChild(wrapper);

    function resolveTheme(configTheme) {
      var pick = configTheme === 'light' || configTheme === 'dark' ? configTheme
        : options.theme === 'light' || options.theme === 'dark' ? options.theme
        : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      wrapper.className = 'ot-widget-wrapper ' + (pick === 'light' ? 'ot-light' : 'ot-dark');
    }
    resolveTheme(null);

    function applyBranding() {
      var css = '';
      if (state.brand) {
        css += '.ot-launcher, .ot-user, .ot-send-btn { background: ' + state.brand + ' !important; }';
        css += '.ot-input:focus { border-color: ' + state.brand + ' !important; }';
      }
      if (state.position === 'bottom-left') {
        css += '.ot-widget-wrapper { right: auto !important; left: 24px; } .ot-popup { right: auto !important; left: 0; }';
      }
      brandStyle.textContent = css;
    }

    var state = {
      isOpen: options.mode === 'inline',
      sessionId: null,
      sessionToken: null,
      messages: [],
      isLoading: false,
      title: 'AI Assistant',
      subtitle: 'Universal Agent',
      brand: null,
      position: 'bottom-right',
      suggestions: [],
    };

    var storageKey = 'ot_agent_sess_' + options.agentId;
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          state.sessionId = parsed.sessionId;
          state.sessionToken = parsed.sessionToken;
        }
      }
    } catch (e) {}

    render();

    // Init session
    fetch(options.baseUrl + '/api/v1/agent-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: options.publicKey }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.sessionId) {
          state.sessionId = data.sessionId;
          state.sessionToken = data.sessionToken;
          if (data.deployment) {
            var appearance = (data.deployment.widgetConfig && data.deployment.widgetConfig.appearance) || {};
            state.title = appearance.title || data.deployment.agentName || state.title;
            state.subtitle = appearance.subtitle || data.deployment.agentRole || state.subtitle;
            // Only a plain hex colour is ever put into CSS.
            state.brand = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(appearance.primaryColor || '') ? appearance.primaryColor : null;
            state.position = appearance.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
            state.suggestions = Array.isArray(appearance.suggestedPrompts)
              ? appearance.suggestedPrompts.filter(function (p) { return typeof p === 'string'; }).slice(0, 6)
              : [];
            resolveTheme(appearance.theme);
            applyBranding();
          }
          try {
            localStorage.setItem(storageKey, JSON.stringify({
              sessionId: data.sessionId,
              sessionToken: data.sessionToken,
              expiresAt: data.expiresAt,
            }));
          } catch (e) {}
          loadMessages();
        }
      })
      .catch(function (err) {
        console.error('[Onetab Agent Widget] Session initialization failed:', err);
      });

    function loadMessages() {
      if (!state.sessionId) return;
      fetch(options.baseUrl + '/api/v1/agent-sessions/' + state.sessionId + '/messages', {
        headers: { 'x-session-token': state.sessionToken },
      })
        .then(function (res) { return res.json(); })
        .then(function (msgs) {
          if (Array.isArray(msgs)) {
            state.messages = msgs;
            render();
          }
        });
    }

    function sendMessage(text) {
      if (!text || !text.trim() || state.isLoading) return;
      var cleanText = text.trim();
      state.messages.push({
        id: 'temp_' + Date.now(),
        role: 'user',
        content: cleanText,
        timestamp: new Date().toISOString(),
      });
      state.isLoading = true;
      render();

      fetch(options.baseUrl + '/api/v1/agent-sessions/' + state.sessionId + '/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + state.sessionToken,
        },
        body: JSON.stringify({ message: cleanText }),
      })
        .then(function (res) { return res.json(); })
        .then(function (resData) {
          state.isLoading = false;
          if (resData.output) {
            state.messages.push({
              id: resData.runId || ('msg_' + Date.now()),
              role: 'assistant',
              content: resData.output,
              timestamp: new Date().toISOString(),
              awaitingApproval: resData.awaitingApproval,
            });
          }
          render();
        })
        .catch(function (err) {
          state.isLoading = false;
          state.messages.push({
            id: 'err_' + Date.now(),
            role: 'assistant',
            content: 'Connection error. Please try again.',
            timestamp: new Date().toISOString(),
          });
          render();
        });
    }

    function render() {
      wrapper.innerHTML = '';

      if (options.mode === 'floating') {
        var launcher = document.createElement('button');
        launcher.className = 'ot-launcher';
        launcher.innerHTML = state.isOpen
          ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
          : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
        launcher.onclick = function () {
          state.isOpen = !state.isOpen;
          render();
        };
        wrapper.appendChild(launcher);
      }

      if (state.isOpen || options.mode === 'inline') {
        var card = document.createElement('div');
        card.className = 'ot-card ' + (options.mode === 'inline' ? 'ot-inline' : 'ot-popup');

        // Header
        var header = document.createElement('div');
        header.className = 'ot-header';
        header.innerHTML =
          '<div class="ot-header-info">' +
          '<div class="ot-avatar">🤖</div>' +
          '<div>' +
          '<div class="ot-title">' + escapeHtml(state.title) + '</div>' +
          '<div class="ot-subtitle">' + escapeHtml(state.subtitle) + '</div>' +
          '</div>' +
          '</div>' +
          (options.mode === 'floating'
            ? '<button class="ot-close-btn">&times;</button>'
            : '');
        if (options.mode === 'floating') {
          header.querySelector('.ot-close-btn').onclick = function () {
            state.isOpen = false;
            render();
          };
        }
        card.appendChild(header);

        // Messages list
        var msgList = document.createElement('div');
        msgList.className = 'ot-messages';
        var chipsShown = false;
        for (var i = 0; i < state.messages.length; i++) {
          var m = state.messages[i];
          var bubble = document.createElement('div');
          bubble.className = 'ot-bubble ' + (m.role === 'user' ? 'ot-user' : 'ot-bot');
          bubble.innerHTML = renderMarkdown(m.content);

          if (m.awaitingApproval) {
            var approvalBox = document.createElement('div');
            approvalBox.className = 'ot-approval-box';
            approvalBox.innerHTML =
              '<div class="ot-approval-title">&#9888; Waiting for approval</div>' +
              '<div class="ot-approval-desc">' + escapeHtml(m.awaitingApproval.description) + '</div>' +
              '<div class="ot-approval-desc">A person on the team has to approve this before it goes ahead.</div>';
            bubble.appendChild(approvalBox);
          }

          msgList.appendChild(bubble);

          // Starter questions sit under the greeting until the visitor says something.
          if (!chipsShown && i === 0 && state.suggestions.length > 0 && state.messages.length <= 1) {
            chipsShown = true;
            var chips = document.createElement('div');
            chips.className = 'ot-chips';
            state.suggestions.forEach(function (text) {
              var chip = document.createElement('button');
              chip.className = 'ot-chip';
              chip.textContent = text;
              chip.onclick = function () { sendMessage(text); };
              chips.appendChild(chip);
            });
            msgList.appendChild(chips);
          }
        }

        if (state.isLoading) {
          var typing = document.createElement('div');
          typing.className = 'ot-bubble ot-bot ot-typing';
          typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
          msgList.appendChild(typing);
        }

        card.appendChild(msgList);
        setTimeout(function () { msgList.scrollTop = msgList.scrollHeight; }, 50);

        // Footer Input
        var footer = document.createElement('div');
        footer.className = 'ot-footer';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'ot-input';
        input.placeholder = 'Type a message...';
        input.onkeydown = function (e) {
          if (e.key === 'Enter') {
            sendMessage(input.value);
            input.value = '';
          }
        };

        var sendBtn = document.createElement('button');
        sendBtn.className = 'ot-send-btn';
        sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        sendBtn.onclick = function () {
          sendMessage(input.value);
          input.value = '';
        };

        footer.appendChild(input);
        footer.appendChild(sendBtn);
        card.appendChild(footer);

        wrapper.appendChild(card);
      }
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

  function getWidgetStyles(opts) {
    return [
      ':host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 999999; }',
      '.ot-widget-wrapper { position: fixed; bottom: 24px; right: 24px; z-index: 999999; }',
      '.ot-launcher { width: 56px; height: 56px; border-radius: 28px; background: #6366f1; color: #fff; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.4); display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }',
      '.ot-launcher:hover { transform: scale(1.05); }',
      '.ot-card { width: 380px; height: 540px; background: #0f172a; border: 1px solid #334155; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; }',
      '.ot-popup { position: absolute; bottom: 70px; right: 0; animation: otSlide 0.2s ease-out; }',
      '.ot-inline { position: relative; width: 100%; height: 500px; }',
      '@keyframes otSlide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
      '.ot-header { background: #1e293b; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; }',
      '.ot-header-info { display: flex; align-items: center; gap: 10px; }',
      '.ot-avatar { font-size: 20px; width: 36px; height: 36px; border-radius: 8px; background: #334155; display: flex; align-items: center; justify-content: center; }',
      '.ot-title { color: #f8fafc; font-size: 14px; font-weight: 600; }',
      '.ot-subtitle { color: #94a3b8; font-size: 11px; }',
      '.ot-close-btn { background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; }',
      '.ot-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }',
      '.ot-bubble { max-width: 82%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.45; word-break: break-word; }',
      '.ot-user { background: #6366f1; color: #fff; align-self: flex-end; border-bottom-right-radius: 2px; }',
      '.ot-bot { background: #1e293b; color: #e2e8f0; align-self: flex-start; border-bottom-left-radius: 2px; }',
      '.ot-typing { display: flex; gap: 4px; padding: 12px 14px; }',
      '.ot-typing .dot { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: otBlink 1.4s infinite both; }',
      '.ot-typing .dot:nth-child(2) { animation-delay: 0.2s; }',
      '.ot-typing .dot:nth-child(3) { animation-delay: 0.4s; }',
      '@keyframes otBlink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }',
      '.ot-approval-box { margin-top: 10px; padding: 10px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); border-radius: 8px; font-size: 12px; }',
      '.ot-approval-title { font-weight: 600; color: #f59e0b; margin-bottom: 4px; }',
      '.ot-approval-desc { color: #cbd5e1; margin-bottom: 8px; }',
      '.ot-light .ot-card { background: #ffffff; border-color: #e2e8f0; box-shadow: 0 10px 30px rgba(15,23,42,0.18); }',
      '.ot-light .ot-header, .ot-light .ot-footer { background: #f8fafc; border-color: #e2e8f0; }',
      '.ot-light .ot-avatar { background: #e2e8f0; }',
      '.ot-light .ot-title { color: #0f172a; }',
      '.ot-light .ot-subtitle, .ot-light .ot-close-btn { color: #64748b; }',
      '.ot-light .ot-bot { background: #f1f5f9; color: #0f172a; }',
      '.ot-light .ot-input { background: #ffffff; border-color: #cbd5e1; color: #0f172a; }',
      '.ot-light .ot-chip { border-color: #cbd5e1; }',
      '.ot-light .ot-approval-desc { color: #475569; }',
      '.ot-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }',
      '.ot-chip { background: transparent; border: 1px solid #475569; color: inherit; border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; }',
      '.ot-chip:hover { border-color: #94a3b8; }',
      '.ot-footer { padding: 12px; background: #1e293b; border-top: 1px solid #334155; display: flex; gap: 8px; }',
      '.ot-input { flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; color: #f8fafc; font-size: 13px; outline: none; }',
      '.ot-input:focus { border-color: #6366f1; }',
      '.ot-send-btn { background: #6366f1; color: #fff; border: none; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; }',
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
          baseUrl: BASE_URL,
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
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${theme === 'light' ? '#ffffff' : '#0f172a'}; }
    .embed-container { width: 100%; height: 100%; display: flex; flex-direction: column; }
  </style>
</head>
<body>
  <div class="embed-container" id="widget-root"></div>
  <script
    src="/api/v1/deployments/sdk/agent-widget.js"
    data-agent-id="${agentId}"
    data-public-key="${publicKey}"
    data-mode="inline"
    data-theme="${theme}"
  ></script>
</body>
</html>`;
}
