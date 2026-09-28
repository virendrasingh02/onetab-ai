/**
 * A minimal Model Context Protocol client over the Streamable HTTP transport
 * (JSON-RPC 2.0 POSTed to one endpoint; the reply is either a JSON body or an
 * SSE stream carrying it).
 *
 * Only what the AI Workspace needs: `initialize` → `tools/list` to discover a
 * server's tools, and `tools/call` to run one. Each operation opens its own
 * session — tool calls are infrequent enough that holding sessions open is
 * not worth the lifecycle bookkeeping.
 *
 * The legacy HTTP+SSE transport (a long-lived GET stream plus a separate POST
 * endpoint) is not supported; servers that only speak it report a clear error
 * rather than a fake "connected".
 */

import { safeFetch } from '@org/api-common';

export const MCP_PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'OneTab AI', version: '1.0.0' };
const DEFAULT_TIMEOUT_MS = 15_000;

export interface MCPToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  /** The server's behaviour hints (MCP tool annotations). Hints, not guarantees. */
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean };
}

/**
 * Whether running this tool needs a human's approval first. Per the MCP spec a
 * tool is assumed able to change things unless it says it is read-only, and
 * assumed destructive unless it says it is not — so only an explicit
 * `readOnlyHint: true` or `destructiveHint: false` runs without asking.
 */
export function mcpToolNeedsApproval(tool: MCPToolDescriptor): boolean {
  if (tool.annotations?.readOnlyHint === true) return false;
  if (tool.annotations?.destructiveHint === false) return false;
  return true;
}

export interface MCPCallResult {
  isError: boolean;
  /** Text parts joined — what a model can read back. */
  text: string;
  content: unknown[];
}

export interface MCPEndpoint {
  url: string;
  token?: string;
  /** Allow a private-network server (self-hosted installs only). */
  allowPrivateNetwork?: boolean;
  timeoutMs?: number;
}

export class MCPClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPClientError';
  }
}

interface RpcReply {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** One HTTP POST. Public servers go through the SSRF guard; redirects are refused. */
async function post(
  endpoint: MCPEndpoint,
  payload: unknown,
  extraHeaders: Record<string, string>,
): Promise<RpcReply> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}),
    ...extraHeaders,
  };
  const body = JSON.stringify(payload);
  const timeoutMs = endpoint.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!endpoint.allowPrivateNetwork) {
    const res = await safeFetch(endpoint.url, {
      method: 'POST',
      headers,
      body,
      timeoutMs,
      maxRedirects: 0,
      maxBytes: 2 * 1024 * 1024,
    });
    return { status: res.status, headers: res.headers, body: res.text() };
  }

  const res = await fetch(endpoint.url, {
    method: 'POST',
    headers,
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const replyHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    replyHeaders[key.toLowerCase()] = value;
  });
  return { status: res.status, headers: replyHeaders, body: await res.text() };
}

/**
 * The JSON-RPC message with `id` out of a reply, whether the server answered
 * with a JSON body or an SSE stream (`data:` lines, possibly several events).
 */
export function extractRpcResponse(reply: RpcReply, id: number): Record<string, unknown> {
  const contentType = reply.headers['content-type'] ?? '';
  const candidates: unknown[] = [];

  if (contentType.includes('text/event-stream')) {
    for (const event of reply.body.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      try {
        candidates.push(JSON.parse(data));
      } catch {
        /* not JSON — skip */
      }
    }
  } else if (reply.body.trim()) {
    try {
      const parsed = JSON.parse(reply.body);
      candidates.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      throw new MCPClientError('The server did not reply with JSON-RPC.');
    }
  }

  const match = candidates.find(
    (m): m is Record<string, unknown> =>
      !!m && typeof m === 'object' && (m as Record<string, unknown>)['id'] === id,
  );
  if (!match) throw new MCPClientError('The server did not answer the request.');
  const error = match['error'] as { message?: string; code?: number } | undefined;
  if (error) {
    throw new MCPClientError(`The server returned an error: ${error.message ?? `code ${error.code}`}.`);
  }
  return (match['result'] as Record<string, unknown>) ?? {};
}

function assertOk(reply: RpcReply, step: string) {
  if (reply.status === 401 || reply.status === 403) {
    throw new MCPClientError(`The server refused the credentials during ${step} (HTTP ${reply.status}).`);
  }
  if (reply.status === 404 || reply.status === 405) {
    throw new MCPClientError(
      `No Streamable HTTP MCP endpoint at this URL (HTTP ${reply.status}). Legacy SSE-only servers aren't supported.`,
    );
  }
  if (reply.status < 200 || reply.status >= 300) {
    throw new MCPClientError(`The server answered HTTP ${reply.status} during ${step}.`);
  }
}

interface Session {
  headers: Record<string, string>;
  serverName?: string;
}

async function openSession(endpoint: MCPEndpoint): Promise<Session> {
  const reply = await post(
    endpoint,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    },
    {},
  );
  assertOk(reply, 'initialize');
  const result = extractRpcResponse(reply, 1);
  const sessionId = reply.headers['mcp-session-id'];
  const version =
    typeof result['protocolVersion'] === 'string' ? (result['protocolVersion'] as string) : MCP_PROTOCOL_VERSION;
  const headers: Record<string, string> = {
    'mcp-protocol-version': version,
    ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
  };

  // The spec requires this notification before other requests; servers
  // answer 202 with no body.
  const ack = await post(endpoint, { jsonrpc: '2.0', method: 'notifications/initialized' }, headers);
  if (ack.status >= 400) assertOk(ack, 'initialized notification');

  const serverInfo = result['serverInfo'] as { name?: string } | undefined;
  return { headers, serverName: serverInfo?.name };
}

/** Connects and lists the server's tools (following `nextCursor` pages). */
export async function discoverMCPTools(
  endpoint: MCPEndpoint,
): Promise<{ serverName?: string; tools: MCPToolDescriptor[] }> {
  const session = await openSession(endpoint);
  const tools: MCPToolDescriptor[] = [];
  let cursor: string | undefined;
  for (let page = 0, id = 2; page < 10; page++, id++) {
    const reply = await post(
      endpoint,
      { jsonrpc: '2.0', id, method: 'tools/list', params: cursor ? { cursor } : {} },
      session.headers,
    );
    assertOk(reply, 'tools/list');
    const result = extractRpcResponse(reply, id);
    for (const raw of (result['tools'] as unknown[]) ?? []) {
      const tool = raw as Record<string, unknown>;
      if (typeof tool['name'] !== 'string') continue;
      tools.push({
        name: tool['name'],
        ...(typeof tool['description'] === 'string' ? { description: tool['description'] } : {}),
        ...(tool['inputSchema'] && typeof tool['inputSchema'] === 'object'
          ? { inputSchema: tool['inputSchema'] as Record<string, unknown> }
          : {}),
        ...(tool['annotations'] && typeof tool['annotations'] === 'object'
          ? { annotations: pickAnnotations(tool['annotations'] as Record<string, unknown>) }
          : {}),
      });
    }
    cursor = typeof result['nextCursor'] === 'string' ? (result['nextCursor'] as string) : undefined;
    if (!cursor) break;
  }
  return { serverName: session.serverName, tools };
}

function pickAnnotations(raw: Record<string, unknown>): MCPToolDescriptor['annotations'] {
  return {
    ...(typeof raw['title'] === 'string' ? { title: raw['title'] } : {}),
    ...(typeof raw['readOnlyHint'] === 'boolean' ? { readOnlyHint: raw['readOnlyHint'] } : {}),
    ...(typeof raw['destructiveHint'] === 'boolean' ? { destructiveHint: raw['destructiveHint'] } : {}),
  };
}

/** Runs one tool. A tool-level failure comes back as `isError`, not a throw. */
export async function callMCPTool(
  endpoint: MCPEndpoint,
  name: string,
  args: Record<string, unknown>,
): Promise<MCPCallResult> {
  const session = await openSession(endpoint);
  const reply = await post(
    endpoint,
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } },
    session.headers,
  );
  assertOk(reply, 'tools/call');
  const result = extractRpcResponse(reply, 2);
  const content = Array.isArray(result['content']) ? (result['content'] as unknown[]) : [];
  const text = content
    .map((part) => {
      const p = part as { type?: string; text?: string };
      return p.type === 'text' && typeof p.text === 'string' ? p.text : '';
    })
    .filter(Boolean)
    .join('\n');
  return { isError: result['isError'] === true, text, content };
}
