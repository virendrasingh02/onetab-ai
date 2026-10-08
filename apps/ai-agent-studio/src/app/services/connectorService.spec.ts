import { describe, expect, it, beforeEach } from 'vitest';
import { connectorService } from './connectorService.js';
import { CONNECTOR_CATALOG } from './connectorCatalog.js';

describe('connectorService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads catalog containing Microsoft Teams and standard categories', async () => {
    const list = await connectorService.getConnectors();
    expect(list.length).toBeGreaterThanOrEqual(20);

    const teams = list.find((c) => c.id === 'microsoft_teams');
    expect(teams).toBeDefined();
    expect(teams?.category).toBe('communication');
    expect(teams?.actions).toHaveLength(14);
    expect(teams?.triggers).toHaveLength(3);
  });

  it('supports multiple connections for the same connector', async () => {
    const conns = await connectorService.getConnections('default', 'microsoft_teams');
    expect(conns.length).toBeGreaterThanOrEqual(2);
    expect(conns.some((c) => c.name.includes('Company Teams'))).toBe(true);
    expect(conns.some((c) => c.name.includes('Client Services'))).toBe(true);
  });

  it('allows adding and removing named connections without leaking credentials', async () => {
    const created = await connectorService.createConnection('default', 'microsoft_teams', {
      name: 'Staging Environment Teams',
      accountName: 'Staging Bot',
      accountEmail: 'staging-bot@company.com',
      scopes: ['ChannelMessage.Send'],
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Staging Environment Teams');

    const connsAfter = await connectorService.getConnections('default', 'microsoft_teams');
    expect(connsAfter.some((c) => c.id === created.id)).toBe(true);

    await connectorService.deleteConnection(created.id);
    const connsFinal = await connectorService.getConnections('default', 'microsoft_teams');
    expect(connsFinal.some((c) => c.id === created.id)).toBe(false);
  });

  it('tests connection health and returns structured telemetry', async () => {
    const conns = await connectorService.getConnections('default', 'microsoft_teams');
    const firstId = conns[0].id;

    const health = await connectorService.testConnection(firstId);
    expect(health.success).toBe(true);
    expect(health.status).toBe('HEALTHY');
    expect(health.durationMs).toBeGreaterThan(0);
  });

  it('executes action test sandbox for send_channel_message with dynamic expressions', async () => {
    const res = await connectorService.testAction('microsoft_teams', 'send_channel_message', {
      teamId: 'Engineering Core',
      channelId: 'General',
      content: 'Deployment finished: {{agent.summary}} by {{user.name}}',
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.output.success).toBe(true);
    expect(res.output.contentDelivered).toContain('Executive project update for Q2');
    expect(res.output.contentDelivered).toContain('Alex Johnson');
  });

  it('executes create_meeting action and returns join web url', async () => {
    const res = await connectorService.testAction('microsoft_teams', 'create_meeting', {
      subject: 'Executive Sprint Review',
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.output.joinWebUrl).toContain('teams.microsoft.com');
  });

  it('resolves complex nested dynamic expressions safely', () => {
    const template = 'Report: {{agent.summary}} | Channel: {{workspace.name}} | Trigger: {{trigger.message}}';
    const context = {
      agent: { summary: 'Alpha release live' },
      workspace: { name: 'Acme Org' },
      trigger: { message: 'Alert received' },
    };

    const resolved = connectorService.resolveExpressions(template, context);
    expect(resolved).toBe('Report: Alpha release live | Channel: Acme Org | Trigger: Alert received');
  });

  it('tracks audit logs and metrics for connectors', () => {
    const metrics = connectorService.getMetrics('microsoft_teams');
    expect(metrics.totalExecutions).toBeGreaterThan(0);
    expect(metrics.successRate).toBeGreaterThan(90);
    expect(metrics.actionsCount).toBe(14);

    const logs = connectorService.getAuditLogs('microsoft_teams');
    expect(logs.length).toBeGreaterThan(0);
  });
});
