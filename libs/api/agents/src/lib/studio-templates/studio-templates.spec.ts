import { compileStudioGraph } from '@org/types';
import { describe, expect, it } from 'vitest';
import { STUDIO_TEMPLATES } from './studio-templates.js';

describe('Shopify → Slack → WhatsApp template', () => {
  const template = STUDIO_TEMPLATES.find((t) => t.id === 'shopify-order-slack-whatsapp');

  it('is offered, and compiles to real connector steps with no blocking problems except the channel and template name to fill in', () => {
    expect(template).toBeDefined();
    const result = compileStudioGraph({ nodes: template?.nodes, edges: template?.edges });
    const trigger = result.nodes.find((n) => n.id === 'order-1');
    expect(trigger?.config).toMatchObject({ trigger: 'TRIGGER_APP_EVENT', connector: { provider: 'SHOPIFY', triggerId: 'new_order' } });
    expect(result.nodes.find((n) => n.id === 'slack-1')?.config).toMatchObject({ toolName: 'SLACK.send_message' });
    expect(result.nodes.find((n) => n.id === 'whatsapp-1')?.config).toMatchObject({ toolName: 'WHATSAPP.send_template_message' });
    expect(result.issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('asks a person before the customer is messaged, and only the customer message', () => {
    const result = compileStudioGraph({ nodes: template?.nodes, edges: template?.edges });
    expect(result.nodes.filter((n) => n.type === 'HUMAN_APPROVAL').map((n) => n.id)).toEqual(['whatsapp-1__approval']);
    expect(result.edges.filter((e) => e.target === 'whatsapp-1').map((e) => e.source)).toEqual(['whatsapp-1__approval']);
    expect(result.edges.filter((e) => e.target === 'whatsapp-1__approval').map((e) => e.source)).toEqual(['phone-1']);
  });

  it('only reaches the WhatsApp step for customers who agreed to texts and have a phone number', () => {
    const edges = template?.edges ?? [];
    expect(edges.find((e) => e.source === 'consent-1' && e.sourceHandle === 'true')?.target).toBe('phone-1');
    expect(edges.find((e) => e.source === 'phone-1' && e.sourceHandle === 'false')?.target).toBe('whatsapp-1');
  });
});
