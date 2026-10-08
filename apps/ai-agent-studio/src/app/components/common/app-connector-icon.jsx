import React, { memo } from 'react';
import {
  Github,
  Google,
  Notion,
  Figma,
  OpenAI,
  Claude,
  Gemini,
  Meta,
  Nvidia,
  Mistral,
  DeepSeek,
  Perplexity,
  Groq,
  Cohere,
  Ollama,
  Aws,
  Azure,
  Cloudflare,
  Vercel,
  DigitalOcean,
  Zapier,
  Make,
  N8n,
  MCP,
  Firecrawl,
  LangChain,
  LangGraph,
  LlamaIndex,
  HuggingFace,
  Minimax,
  Moonshot,
  ByteDance,
  Baidu,
  Microsoft,
} from '@lobehub/icons';
import {
  Boxes,
  Database,
  Globe,
  HardDrive,
  Mail,
  MessageSquare,
  Plug,
  Calendar,
  CheckSquare,
  Users,
  Code,
  Sparkles,
  Bot,
  CreditCard,
  Headphones,
  Shield,
  Send,
  FileText,
} from 'lucide-react';

/**
 * Custom SVG Icons for enterprise connectors (Teams, Slack, Discord, Jira, Stripe, Postgres, Mongo, etc.)
 * Provides crisp, high-fidelity brand vectors without external library discrepancies.
 */
function TeamsSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M19.5 7.5a2 2 0 100-4 2 2 0 000 4z" fill="#5059C9" />
      <path d="M21.5 10h-4a1.5 1.5 0 00-1.5 1.5v3.2c.6.4 1.3.8 2.1 1.1.3-.1.6-.3.9-.5V12h2.5a.5.5 0 01.5.5V17c0 .5-.2 1-.5 1.3-.5.6-1.3 1-2.2 1.3-.2.1-.5.1-.8.2v1.7c1.3-.2 2.5-.7 3.5-1.5.6-.5 1-1.2 1-2v-6.5a1.5 1.5 0 00-1.5-1.5z" fill="#5059C9" />
      <path d="M14.5 5.5a2.5 2.5 0 10-5 0 2.5 2.5 0 005 0z" fill="#7B83EB" />
      <path d="M16 9H8a2 2 0 00-2 2v6c0 1.7 1.3 3 3 3h7c1.7 0 3-1.3 3-3v-6a2 2 0 00-2-2z" fill="#5059C9" />
      <path d="M11.5 12h-3v1.5h1.8v4.5h1.2V12z" fill="#FFFFFF" />
    </svg>
  );
}

function SlackSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.04 14.73a2.38 2.38 0 11-2.38-2.38h2.38v2.38z" fill="#E01E5A" />
      <path d="M6.23 14.73a2.38 2.38 0 014.76 0v5.95a2.38 2.38 0 11-4.76 0v-5.95z" fill="#E01E5A" />
      <path d="M9.27 5.04a2.38 2.38 0 112.38-2.38v2.38H9.27z" fill="#36C5F0" />
      <path d="M9.27 6.23a2.38 2.38 0 010 4.76H3.32a2.38 2.38 0 110-4.76h5.95z" fill="#36C5F0" />
      <path d="M18.96 9.27a2.38 2.38 0 112.38 2.38h-2.38V9.27z" fill="#2EB67D" />
      <path d="M17.77 9.27a2.38 2.38 0 01-4.76 0V3.32a2.38 2.38 0 114.76 0v5.95z" fill="#2EB67D" />
      <path d="M14.73 18.96a2.38 2.38 0 11-2.38 2.38v-2.38h2.38z" fill="#ECB22E" />
      <path d="M14.73 17.77a2.38 2.38 0 010-4.76h5.95a2.38 2.38 0 110 4.76h-5.95z" fill="#ECB22E" />
    </svg>
  );
}

function DiscordSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 00-.07.03c-.18.33-.39.76-.53 1.09a16.69 16.69 0 00-4.8 0c-.14-.34-.35-.76-.54-1.09A.09.09 0 009 4c-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.1a10.9 10.9 0 01-1.54-.74c-.04-.02-.05-.07-.01-.1.1-.08.21-.16.31-.24.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.1.08.21.16.31.25.04.03.03.08-.01.1-.49.28-1 .52-1.54.74-.04.02-.06.06-.04.1.31.61.67 1.19 1.07 1.74.02.02.05.03.08.02 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95 0-.01-.02-.02-.03-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.83-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.83-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z"
        fill="#5865F2"
      />
    </svg>
  );
}

function JiraSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M11.53 2C6.27 2 2 6.27 2 11.53c0 2.52 1.02 4.93 2.8 6.71L11.53 2z" fill="#0052CC" />
      <path d="M11.53 2c5.26 0 9.53 4.27 9.53 9.53 0 2.52-1.02 4.93-2.8 6.71L11.53 2z" fill="#2684FF" />
      <path d="M11.53 11.53L4.8 18.26A9.5 9.5 0 0011.53 21a9.5 9.5 0 006.73-2.74l-6.73-6.73z" fill="#0052CC" />
    </svg>
  );
}

function LinearSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M2.5 12a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0z" fill="#5E6AD2" opacity="0.15" />
      <path d="M3.2 14.5l6.3-6.3a2 2 0 012.8 0l8.5 8.5A9.5 9.5 0 013.2 14.5z" fill="#5E6AD2" />
    </svg>
  );
}

function TrelloSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0079BF" />
      <rect x="4" y="4" width="6.5" height="12" rx="1.5" fill="#FFFFFF" />
      <rect x="13.5" y="4" width="6.5" height="8" rx="1.5" fill="#FFFFFF" />
    </svg>
  );
}

function StripeSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#635BFF" />
      <path
        d="M13.9 10.3c0-.7-.6-1-1.6-1-1.4 0-3.1.5-4.4 1.2V7.7c1.4-.6 3.1-.9 4.6-.9 3.6 0 5.8 1.8 5.8 4.7 0 4.6-6.3 3.9-6.3 5.9 0 .8.7 1.1 1.8 1.1 1.6 0 3.6-.7 4.9-1.5v2.8c-1.5.7-3.4 1-5.1 1-3.7 0-6.1-1.8-6.1-4.7 0-4.9 6.4-4.1 6.4-5.8z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function ZendeskSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#03363D" />
      <path d="M13.5 6.5h4v4h-4zM6.5 13.5h4v4h-4z" fill="#FFFFFF" />
      <path d="M6.5 6.5h4v4c-2.2 0-4-1.8-4-4zM13.5 17.5h4v-4c-2.2 0-4 1.8-4 4z" fill="#00A656" />
    </svg>
  );
}

function PostgresSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#336791" />
      <path d="M12 5c-3.3 0-6 2.7-6 6 0 2.5 1.5 4.6 3.7 5.5v2.5h4.6v-2.5c2.2-.9 3.7-3 3.7-5.5 0-3.3-2.7-6-6-6zm0 2c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z" fill="#FFFFFF" />
    </svg>
  );
}

function MongoSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#001E2B" />
      <path d="M12 3s-4 4.5-4 9.5c0 3.5 2.5 6 4 6.5 1.5-.5 4-3 4-6.5C16 7.5 12 3 12 3zm0 14c-.8-.5-2-2.1-2-4.5 0-2.8 2-5.7 2-5.7s2 2.9 2 5.7c0 2.4-1.2 4-2 4.5z" fill="#00ED64" />
    </svg>
  );
}

function RedisSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#DC382D" />
      <path d="M12 6l5 3-5 3-5-3 5-3zm-5 5.5l5 3 5-3v2.5l-5 3-5-3v-2.5z" fill="#FFFFFF" />
    </svg>
  );
}

function SupabaseSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1C1C1C" />
      <path d="M13 3.5L5.5 13.5h6l-1 7 7.5-10h-6l1-7z" fill="#3ECF8E" />
    </svg>
  );
}

function OutlookSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M14.5 4h6a1.5 1.5 0 011.5 1.5v13a1.5 1.5 0 01-1.5 1.5h-6V4z" fill="#0078D4" />
      <path d="M14.5 8.5l7 4.2V6.8l-7-2.8v4.5z" fill="#28A8EA" opacity="0.8" />
      <path d="M14.5 15.5l7-4.2v5.9a1.5 1.5 0 01-1.5 1.5h-5.5v-3.2z" fill="#004E8C" opacity="0.6" />
      <rect x="2" y="5.5" width="12" height="13" rx="2" fill="#0078D4" />
      <circle cx="8" cy="12" r="3.2" fill="#FFFFFF" />
      <circle cx="8" cy="12" r="1.8" fill="#0078D4" />
    </svg>
  );
}

function TelegramSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#229ED9" />
      <path d="M5.5 11.8l11-4.2c.5-.2 1 .2.8.7l-1.9 8.8c-.1.6-.8.8-1.3.5l-3.2-2.3-1.5 1.5c-.3.3-.8.1-.8-.3l.3-3.2 5.8-5.2c.2-.2 0-.5-.3-.3l-7.2 4.5-1.7-.5c-.5-.2-.5-.8 0-1z" fill="#FFFFFF" />
    </svg>
  );
}

function SalesforceSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9.5 7.5a4.5 4.5 0 018.6-1.5A4.5 4.5 0 0122 10.5c0 2.2-1.8 4-4 4h-12a4 4 0 01-1.8-7.6 5 5 0 015.3.6z" fill="#00A1E0" />
      <path d="M12 10c.8 0 1.5.3 2 .8l-.8.8c-.3-.3-.7-.5-1.2-.5-.8 0-1.5.6-1.5 1.4s.7 1.4 1.5 1.4c.5 0 .9-.2 1.2-.5l.8.8c-.5.5-1.2.8-2 .8-1.5 0-2.6-1.1-2.6-2.5S10.5 10 12 10z" fill="#FFFFFF" />
    </svg>
  );
}

function HubSpotSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M17.5 10.5V7.8a2 2 0 10-1.5 0v2.7a5.5 5.5 0 00-3.3 2.5l-4-3.1a2 2 0 10-1.2 1l3.9 3a5.5 5.5 0 106.1-3.4zm-1-4.3a.8.8 0 110-1.6.8.8 0 010 1.6zM6.5 10.2a.8.8 0 110-1.6.8.8 0 010 1.6zM15 17a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" fill="#FF7A59" />
    </svg>
  );
}

function GoogleDriveSvg({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8.2 3.5h7.6l6.2 10.7-3.8 6.5H10.6L8.2 3.5z" fill="#FFC107" opacity="0.9" />
      <path d="M2 14.2l3.8-6.6 7.6 13.1H5.8L2 14.2z" fill="#0066DA" />
      <path d="M10.6 20.7h11.4l-3.8-6.5H6.8l3.8 6.5z" fill="#00AC47" />
    </svg>
  );
}

/**
 * Normalized mapping from connector ID or provider key to verified brand components
 */
const BRAND_ICON_MAP = {
  // AI & LLM Providers
  openai: OpenAI,
  anthropic: Claude,
  claude: Claude,
  google_gemini: Gemini,
  gemini: Gemini,
  nvidia: Nvidia,
  mistral: Mistral,
  deepseek: DeepSeek,
  perplexity: Perplexity,
  groq: Groq,
  cohere: Cohere,
  ollama: Ollama,
  meta: Meta,
  huggingface: HuggingFace,
  langchain: LangChain,
  langgraph: LangGraph,
  llamaindex: LlamaIndex,
  minimax: Minimax,
  moonshot: Moonshot,
  bytedance: ByteDance,
  baidu: Baidu,

  // Development & Code
  github: Github,
  git: Github,

  // Productivity
  notion: Notion,
  figma: Figma,
  google: Google,
  gmail: Google,
  google_calendar: Google,

  // Cloud & Web
  aws: Aws,
  s3: Aws,
  azure: Azure,
  cloudflare: Cloudflare,
  vercel: Vercel,
  digitalocean: DigitalOcean,
  microsoft: Microsoft,

  // Automation
  zapier: Zapier,
  make: Make,
  n8n: N8n,
  mcp: MCP,
  mcp_servers: MCP,
  firecrawl: Firecrawl,
};

/**
 * Universal App Connector Icon Component
 * Dynamically resolves official brand graphics, custom vector logos, or rich category fallbacks
 *
 * @param {{
 *   connectorId?: string | null;
 *   name?: string;
 *   category?: string;
 *   size?: number;
 *   className?: string;
 *   variant?: 'color' | 'mono';
 *   customIconUrl?: string | null;
 * }} props
 */
function AppConnectorIconBase({
  connectorId,
  name = '',
  category = '',
  size = 20,
  className = '',
  variant = 'color',
  customIconUrl = null,
}) {
  // If user provided a custom uploaded icon URL
  if (customIconUrl) {
    return (
      <img
        src={customIconUrl}
        alt={name || connectorId || 'Custom Connector'}
        className={`object-contain rounded-sm shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const id = String(connectorId || '').toLowerCase().replace(/-/g, '_');

  // 1. High-fidelity dedicated custom vector icons
  if (id.includes('teams') || id === 'microsoft_teams') {
    return <TeamsSvg size={size} className={className} />;
  }
  if (id.includes('slack')) {
    return <SlackSvg size={size} className={className} />;
  }
  if (id.includes('discord')) {
    return <DiscordSvg size={size} className={className} />;
  }
  if (id.includes('jira')) {
    return <JiraSvg size={size} className={className} />;
  }
  if (id.includes('linear')) {
    return <LinearSvg size={size} className={className} />;
  }
  if (id.includes('trello')) {
    return <TrelloSvg size={size} className={className} />;
  }
  if (id.includes('stripe') || id.includes('pay')) {
    return <StripeSvg size={size} className={className} />;
  }
  if (id.includes('zendesk') || id.includes('ticket')) {
    return <ZendeskSvg size={size} className={className} />;
  }
  if (id.includes('postgres') || id.includes('postgresql')) {
    return <PostgresSvg size={size} className={className} />;
  }
  if (id.includes('mongo') || id.includes('mongodb')) {
    return <MongoSvg size={size} className={className} />;
  }
  if (id.includes('redis')) {
    return <RedisSvg size={size} className={className} />;
  }
  if (id.includes('supabase')) {
    return <SupabaseSvg size={size} className={className} />;
  }
  if (id.includes('outlook') || id === 'microsoft_outlook') {
    return <OutlookSvg size={size} className={className} />;
  }
  if (id.includes('telegram')) {
    return <TelegramSvg size={size} className={className} />;
  }
  if (id.includes('salesforce')) {
    return <SalesforceSvg size={size} className={className} />;
  }
  if (id.includes('hubspot')) {
    return <HubSpotSvg size={size} className={className} />;
  }
  if (id.includes('drive') || id === 'google_drive') {
    return <GoogleDriveSvg size={size} className={className} />;
  }

  // 2. Lookup in verified LobeHub brand icon registry
  const BrandComponent = BRAND_ICON_MAP[id];
  if (BrandComponent) {
    const ComponentToRender = BrandComponent.Color || BrandComponent;
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size }}
      >
        <ComponentToRender size={size} aria-hidden="true" />
      </span>
    );
  }

  // 3. Keyword matching fallbacks
  if (id.includes('git') || id.includes('repo')) {
    const GitComp = Github.Color || Github;
    return <GitComp size={size} className={className} />;
  }
  if (id.includes('google') || id.includes('gmail')) {
    const GoogleComp = Google.Color || Google;
    return <GoogleComp size={size} className={className} />;
  }
  if (id.includes('notion')) {
    const NotionComp = Notion.Color || Notion;
    return <NotionComp size={size} className={className} />;
  }

  // 4. Category-based fallback icon from Lucide
  const cat = String(category).toLowerCase();
  let FallbackIcon = Boxes;
  if (cat.includes('comm') || cat.includes('chat') || cat.includes('messag')) FallbackIcon = MessageSquare;
  else if (cat.includes('email') || cat.includes('mail')) FallbackIcon = Mail;
  else if (cat.includes('cal')) FallbackIcon = Calendar;
  else if (cat.includes('proj') || cat.includes('task')) FallbackIcon = CheckSquare;
  else if (cat.includes('crm') || cat.includes('user')) FallbackIcon = Users;
  else if (cat.includes('dev')) FallbackIcon = Code;
  else if (cat.includes('data') || cat.includes('sql')) FallbackIcon = Database;
  else if (cat.includes('ai') || cat.includes('llm') || cat.includes('model')) FallbackIcon = Bot;
  else if (cat.includes('pay') || cat.includes('fin')) FallbackIcon = CreditCard;
  else if (cat.includes('supp') || cat.includes('help')) FallbackIcon = Headphones;
  else if (cat.includes('stor') || cat.includes('cloud')) FallbackIcon = HardDrive;
  else if (cat.includes('web') || cat.includes('auto')) FallbackIcon = Globe;
  else if (cat.includes('sec')) FallbackIcon = Shield;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      style={{ width: size, height: size }}
    >
      <FallbackIcon className="size-full shrink-0" aria-hidden="true" />
    </span>
  );
}

export const AppConnectorIcon = memo(AppConnectorIconBase);
