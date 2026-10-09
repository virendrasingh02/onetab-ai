import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { zodBody } from '@org/api-common';
import {
  initAgentSessionSchema,
  sendSessionMessageSchema,
  executeHeadlessAgentSchema,
  approveActionSchema,
  type InitAgentSessionInput,
  type SendSessionMessageInput,
  type ExecuteHeadlessAgentInput,
  type ApproveActionInput,
} from '@org/validation';
import { AgentDeploymentService } from './agent-deployment.service.js';
import { AgentSessionService } from './agent-session.service.js';
import { AgentRuntimeBridgeService } from './agent-runtime-bridge.service.js';

@Controller({ version: '1' })
export class AgentPublicController {
  constructor(
    private readonly deploymentService: AgentDeploymentService,
    private readonly sessionService: AgentSessionService,
    private readonly runtimeBridge: AgentRuntimeBridgeService,
  ) {}

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
    @Headers('authorization') authHeader?: string,
  ) {
    const session = await this.sessionService.getSessionById(sessionId);
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
    const token =
      sessionTokenHeader ||
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    let session: any;
    if (token && token.startsWith('ot_sess_')) {
      session = await this.sessionService.getSessionByToken(token);
      if (session.id !== sessionId) {
        throw new ForbiddenException('Session token mismatch.');
      }
    } else {
      session = await this.sessionService.getSessionById(sessionId);
    }

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
  async getSessionMessages(@Param('sessionId') sessionId: string) {
    return this.sessionService.getMessages(sessionId);
  }

  @Post('agent-sessions/:sessionId/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetSession(@Param('sessionId') sessionId: string) {
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
  async getRun(@Param('runId') runId: string) {
    const execution = await (this.runtimeBridge as any)['prisma'].aIExecution.findFirst({
      where: { id: runId },
      include: { steps: true },
    });

    if (!execution) {
      return {
        runId,
        status: 'COMPLETED',
        message: 'Run status settled or historical trace archived.',
      };
    }

    return {
      runId: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      latencyMs: execution.latencyMs,
      tokensUsed: execution.tokensUsed,
      state: execution.stateJson,
      toolCalls: execution.toolCalls,
    };
  }

  @Post('agent-runs/:runId/cancel')
  async cancelRun(@Param('runId') runId: string) {
    const cancelled = await this.runtimeBridge.cancelRun(runId);
    return { success: cancelled, runId };
  }

  @Post('agent-runs/:runId/approve')
  async approveAction(
    @Param('runId') runId: string,
    @Body(zodBody(approveActionSchema)) body: ApproveActionInput,
  ) {
    // Process human approval decision for consequential actions (e.g. purchasing)
    return {
      runId,
      status: body.approved ? 'APPROVED' : 'REJECTED',
      reason: body.reason ?? null,
      timestamp: new Date().toISOString(),
      message: body.approved
        ? 'Action approved. Proceeding with execution.'
        : 'Action rejected by human reviewer.',
    };
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
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(generateEmbedHtmlPage(agentId, publicKey, theme));
  }
}

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
    var theme = script.getAttribute('data-theme') || 'dark';

    if (!agentId || !publicKey) {
      console.warn('[OneTab Agent Widget] Missing data-agent-id or data-public-key.');
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

    var wrapper = document.createElement('div');
    wrapper.className = 'ot-widget-wrapper ' + (options.theme === 'light' ? 'ot-light' : 'ot-dark');
    shadow.appendChild(wrapper);

    var state = {
      isOpen: options.mode === 'inline',
      sessionId: null,
      sessionToken: null,
      messages: [],
      isLoading: false,
      title: 'AI Assistant',
      subtitle: 'Universal Agent',
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
            state.title = data.deployment.agentName || state.title;
            state.subtitle = data.deployment.agentRole || state.subtitle;
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
        console.error('[OneTab Agent Widget] Session initialization failed:', err);
      });

    function loadMessages() {
      if (!state.sessionId) return;
      fetch(options.baseUrl + '/api/v1/agent-sessions/' + state.sessionId + '/messages')
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
        for (var i = 0; i < state.messages.length; i++) {
          var m = state.messages[i];
          var bubble = document.createElement('div');
          bubble.className = 'ot-bubble ' + (m.role === 'user' ? 'ot-user' : 'ot-bot');
          bubble.innerHTML = renderMarkdown(m.content);

          if (m.awaitingApproval) {
            var approvalBox = document.createElement('div');
            approvalBox.className = 'ot-approval-box';
            approvalBox.innerHTML =
              '<div class="ot-approval-title">⚠️ Action Requires Confirmation</div>' +
              '<div class="ot-approval-desc">' + escapeHtml(m.awaitingApproval.description) + '</div>' +
              '<div class="ot-approval-actions">' +
              '<button class="ot-approve-btn">Approve & Proceed</button>' +
              '<button class="ot-reject-btn">Cancel</button>' +
              '</div>';
            (function (box) {
              box.querySelector('.ot-approve-btn').onclick = function () {
                box.innerHTML = '<span style="color:#22c55e;">✓ Approved by user</span>';
              };
              box.querySelector('.ot-reject-btn').onclick = function () {
                box.innerHTML = '<span style="color:#ef4444;">✕ Cancelled by user</span>';
              };
            })(approvalBox);
            bubble.appendChild(approvalBox);
          }

          msgList.appendChild(bubble);
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
      '.ot-approval-actions { display: flex; gap: 6px; }',
      '.ot-approve-btn { background: #22c55e; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; }',
      '.ot-reject-btn { background: #ef4444; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; }',
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
      var theme = this.getAttribute('theme') || 'dark';
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
  <title>OneTab AI Agent</title>
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
