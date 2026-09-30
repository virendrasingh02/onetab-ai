import { storage } from './storage.js';

const WIDGET_CONFIGS_KEY = 'widget_configs_by_agent';

export const deploymentService = {
  getWidgetConfig(agentId) {
    const all = storage.get(WIDGET_CONFIGS_KEY) || {};
    return (
      all[agentId] || {
        enabled: true,
        title: 'OneTab AI Assistant',
        subtitle: 'Powered by Enterprise Autonomous Agents',
        primaryColor: '#6366f1',
        theme: 'dark',
        position: 'bottom-right',
        welcomeMessage: 'Hello! I am your AI assistant. How can I help you today?',
        suggestedPrompts: [
          'How do I configure Single Sign-On?',
          'What are the API rate limits?',
          'Check the status of my invoice refund',
        ],
        allowedDomains: ['app.example.com', 'localhost'],
        allowAttachments: true,
        showBranding: true,
      }
    );
  },

  saveWidgetConfig(agentId, config) {
    const all = storage.get(WIDGET_CONFIGS_KEY) || {};
    all[agentId] = { ...this.getWidgetConfig(agentId), ...config };
    storage.set(WIDGET_CONFIGS_KEY, all);
    return all[agentId];
  },

  generateEmbedSnippet(agentId, config) {
    return `<!-- OneTab AI Autonomous Agent Widget -->
<script
  src="https://cdn.onetab.ai/v1/widget.js"
  data-agent-id="${agentId}"
  data-theme="${config.theme || 'dark'}"
  data-primary-color="${config.primaryColor || '#6366f1'}"
  data-title="${encodeURIComponent(config.title || 'AI Assistant')}"
  defer
></script>`;
  },
};
