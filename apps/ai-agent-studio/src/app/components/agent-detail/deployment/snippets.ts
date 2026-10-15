/**
 * The install and call snippets a deployment offers, generated from the real
 * deployment (agent id, public key) and the API address Studio is talking to.
 * Pure on purpose, so the output is easy to test and cannot drift from the
 * routes the API actually serves.
 */

export type SnippetId =
  | 'widget'
  | 'inline'
  | 'iframe'
  | 'webComponent'
  | 'react'
  | 'curl'
  | 'node'
  | 'python'
  | 'headless'
  | 'desktop';

export interface SnippetInput {
  /** API base including the version prefix, e.g. `https://api.example.com/api/v1`. */
  apiBase: string;
  agentId: string;
  /** The deployment's public key (`ot_pub_…`), safe to ship in a web page. */
  publicKey: string;
  theme?: string;
}

/** The API base with no trailing slash. */
const trimBase = (apiBase: string) => apiBase.replace(/\/+$/, '');

export function buildSnippets({ apiBase, agentId, publicKey, theme }: SnippetInput): Record<SnippetId, string> {
  const base = trimBase(apiBase);
  const sdk = `${base}/deployments/sdk/agent-widget.js`;
  const embed = `${base}/deployments/sdk/agent-embed.html`;
  const executeUrl = `${base}/agents/${agentId}/execute`;
  // The widget follows the theme saved in Widget Studio on its own. Only the
  // iframe page needs it up front, to paint the right background before the widget loads.
  const themeParam = theme === 'light' || theme === 'dark' ? `&theme=${theme}` : '';

  return {
    widget: `<script
  src="${sdk}"
  data-agent-id="${agentId}"
  data-public-key="${publicKey}"
  async
></script>`,

    inline: `<!-- Place this where the assistant should appear -->
<div
  id="onetab-agent-container"
  style="width: 100%; height: 600px; border-radius: 12px; overflow: hidden;"
></div>
<script
  src="${sdk}"
  data-agent-id="${agentId}"
  data-public-key="${publicKey}"
  data-mode="inline"
  async
></script>`,

    iframe: `<iframe
  src="${embed}?agentId=${agentId}&publicKey=${publicKey}${themeParam}"
  width="100%"
  height="650"
  frameborder="0"
  style="border: 1px solid #e2e8f0; border-radius: 12px;"
  allow="clipboard-write"
></iframe>`,

    webComponent: `<script type="module" src="${sdk}"></script>

<onetab-agent
  agent-id="${agentId}"
  public-key="${publicKey}"
></onetab-agent>`,

    react: `import { useEffect } from 'react';

export function AgentWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${sdk}';
    script.async = true;
    script.dataset.agentId = '${agentId}';
    script.dataset.publicKey = '${publicKey}';
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.getElementById('onetab-agent-widget-${agentId}')?.remove();
    };
  }, []);

  return null; // the widget renders itself in a Shadow DOM host
}`,

    curl: `curl -X POST "${executeUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_AGENT_API_KEY" \\
  -d '{
    "prompt": "Summarise the open support tickets",
    "context": { "channel": "support" }
  }'`,

    node: `const response = await fetch('${executeUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${process.env.ONETAB_AGENT_KEY}\`,
  },
  body: JSON.stringify({
    prompt: "Summarise the open support tickets",
    context: { channel: 'support' },
  }),
});

const run = await response.json();
console.log(run.status); // e.g. COMPLETED or WAITING_FOR_APPROVAL
console.log(run.output);`,

    python: `import os
import requests

res = requests.post(
    "${executeUrl}",
    headers={"Authorization": f"Bearer {os.environ['ONETAB_AGENT_KEY']}"},
    json={
        "prompt": "Summarise the open support tickets",
        "context": {"channel": "support"},
    },
    timeout=120,
)
run = res.json()
print(run["status"])
print(run["output"])`,

    headless: `// Server-to-server worker: no chat UI, no browser.
async function runAgent(prompt, context = {}) {
  const res = await fetch('${executeUrl}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${process.env.ONETAB_AGENT_KEY}\`,
    },
    body: JSON.stringify({ prompt, context }),
  });
  if (!res.ok) throw new Error(\`Agent run failed: HTTP \${res.status}\`);

  const run = await res.json();
  if (run.status === 'WAITING_FOR_APPROVAL') {
    // A person has to approve the pending action in Studio before this run continues.
    return { pending: true, runId: run.runId };
  }
  return { pending: false, output: run.output };
}`,

    desktop: `// In the Onetab desktop app's renderer
const run = await window.onetabDesktop.agent.execute({
  agentId: '${agentId}',
  input: 'Check inventory for the M3 Pro 36 GB',
});

console.log(run.status, run.result ?? run.error);`,
  };
}
