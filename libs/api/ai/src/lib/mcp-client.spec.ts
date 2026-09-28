import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callMCPTool,
  discoverMCPTools,
  extractRpcResponse,
  MCPClientError,
  type MCPEndpoint,
} from './mcp-client.js';

/** A tiny Streamable-HTTP MCP server: JSON for some replies, SSE for others. */
function createFakeServer() {
  const seen: Array<{ method: string; session?: string; auth?: string }> = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (req.url === '/missing') {
        res.writeHead(404);
        res.end();
        return;
      }
      const msg = JSON.parse(raw) as { id?: number; method: string; params?: any };
      seen.push({
        method: msg.method,
        session: req.headers['mcp-session-id'] as string | undefined,
        auth: req.headers['authorization'] as string | undefined,
      });
      if (req.url === '/locked' && req.headers['authorization'] !== 'Bearer s3cret') {
        res.writeHead(401);
        res.end();
        return;
      }
      const reply = (result: unknown, sse = false) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result });
        if (sse) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end(`event: message\ndata: ${body}\n\n`);
        } else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(body);
        }
      };
      switch (msg.method) {
        case 'initialize':
          res.setHeader('mcp-session-id', 'session-123');
          reply({ protocolVersion: '2025-06-18', serverInfo: { name: 'fake' }, capabilities: {} });
          return;
        case 'notifications/initialized':
          res.writeHead(202);
          res.end();
          return;
        case 'tools/list':
          if (!msg.params?.cursor) {
            reply({ tools: [{ name: 'search', description: 'Search', inputSchema: { type: 'object' } }], nextCursor: 'p2' }, true);
          } else {
            reply({ tools: [{ name: 'fetch_page' }, { bogus: true }] });
          }
          return;
        case 'tools/call':
          if (msg.params.name === 'boom') {
            reply({ isError: true, content: [{ type: 'text', text: 'it broke' }] });
          } else {
            reply({ content: [{ type: 'text', text: `hello ${msg.params.arguments.who}` }, { type: 'image', data: 'x' }] }, true);
          }
          return;
        default:
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } }));
      }
    });
  });
  return { server, seen };
}

describe('MCP client', () => {
  const { server, seen } = createFakeServer();
  let base: string;
  const endpoint = (path = '/mcp', extra: Partial<MCPEndpoint> = {}): MCPEndpoint => ({
    url: `${base}${path}`,
    allowPrivateNetwork: true,
    ...extra,
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('initializes, acknowledges, and lists tools across pages and reply formats', async () => {
    seen.length = 0;
    const { serverName, tools } = await discoverMCPTools(endpoint());
    expect(serverName).toBe('fake');
    expect(tools.map((t) => t.name)).toEqual(['search', 'fetch_page']);
    expect(tools[0]?.inputSchema).toEqual({ type: 'object' });
    expect(seen.map((s) => s.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
      'tools/list',
    ]);
    // The session id from initialize is carried on every later request.
    expect(seen.slice(1).every((s) => s.session === 'session-123')).toBe(true);
  });

  it('calls a tool and returns its text', async () => {
    const result = await callMCPTool(endpoint(), 'greet', { who: 'world' });
    expect(result.isError).toBe(false);
    expect(result.text).toBe('hello world');
    expect(result.content).toHaveLength(2);
  });

  it('reports a tool-level failure as isError, not a throw', async () => {
    const result = await callMCPTool(endpoint(), 'boom', {});
    expect(result).toMatchObject({ isError: true, text: 'it broke' });
  });

  it('sends the bearer token and explains a refusal', async () => {
    await expect(discoverMCPTools(endpoint('/locked'))).rejects.toThrow(/refused the credentials/);
    const ok = await discoverMCPTools(endpoint('/locked', { token: 's3cret' }));
    expect(ok.tools.length).toBeGreaterThan(0);
  });

  it('explains a URL with no Streamable HTTP endpoint', async () => {
    await expect(discoverMCPTools(endpoint('/missing'))).rejects.toThrow(/No Streamable HTTP MCP endpoint/);
  });

  it('refuses a private server unless explicitly allowed', async () => {
    await expect(discoverMCPTools({ url: `${base}/mcp` })).rejects.toThrow();
  });
});

describe('extractRpcResponse', () => {
  it('surfaces a JSON-RPC error message', () => {
    expect(() =>
      extractRpcResponse(
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 3, error: { code: -1, message: 'nope' } }),
        },
        3,
      ),
    ).toThrow(MCPClientError);
  });

  it('finds the matching reply among several SSE events', () => {
    const body = [
      `data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress' })}`,
      `data: ${JSON.stringify({ jsonrpc: '2.0', id: 7, result: { ok: true } })}`,
    ].join('\n\n');
    expect(
      extractRpcResponse({ status: 200, headers: { 'content-type': 'text/event-stream' }, body }, 7),
    ).toEqual({ ok: true });
  });
});
