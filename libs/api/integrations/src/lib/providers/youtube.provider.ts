import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import axios from 'axios';
import { oauthEnv } from '../core/oauth-app-context.js';
import type {
  ActionContext,
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

@Injectable()
export class YouTubeProvider implements ProviderAdapter {
  readonly providerId = 'YOUTUBE';
  private readonly logger = new Logger(YouTubeProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'YouTube',
      description:
        'Official YouTube integration for channel research, video metadata, comments, analytics, and upload management.',
      category: 'Social Media & Video',
      connectorCategory: 'marketing',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'https://www.googleapis.com/auth/youtube.readonly',
          description: 'Read your YouTube account, channel statistics, and videos',
          required: true,
        },
        {
          scope: 'https://www.googleapis.com/auth/youtube.upload',
          description: 'Upload and manage videos on your channel',
          required: false,
        },
        {
          scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
          description: 'Manage YouTube comments, ratings, and video details',
          required: false,
        },
      ],
    };
  }

  private clientCreds() {
    const clientId =
      oauthEnv(this.config, 'YOUTUBE_CLIENT_ID') ||
      oauthEnv(this.config, 'GOOGLE_CLIENT_ID');
    const clientSecret =
      oauthEnv(this.config, 'YOUTUBE_CLIENT_SECRET') ||
      oauthEnv(this.config, 'GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'YouTube OAuth is not configured on this server (YOUTUBE_CLIENT_ID or GOOGLE_CLIENT_ID missing).',
      );
    }
    return { clientId, clientSecret };
  }

  private redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>('YOUTUBE_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/youtube/callback'
    );
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[] },
  ): Promise<string> {
    const { clientId } = this.clientCreds();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(options?.redirectUri),
      response_type: 'code',
      scope: (options?.scopes?.length ? options.scopes : YOUTUBE_SCOPES).join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri(options?.redirectUri),
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const data = response.data as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    let accountName = 'YouTube Channel';
    let accountId = 'channel';
    try {
      const channelRes = await axios.get(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${data.access_token}` } },
      );
      const item = (channelRes.data as { items?: Array<{ id: string; snippet: { title: string } }> })
        ?.items?.[0];
      if (item) {
        accountId = item.id;
        accountName = item.snippet.title;
      }
    } catch {
      // Fallback
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : YOUTUBE_SCOPES,
      accountId,
      accountName,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const data = response.data as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    try {
      const res = await axios.get(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        { headers: { Authorization: `Bearer ${credential.accessToken}` } },
      );
      const item = (res.data as { items?: any[] })?.items?.[0];
      return {
        id: item?.id ?? credential.metadata['accountId'] ?? 'channel',
        name: item?.snippet?.title ?? credential.metadata['accountName'] ?? 'YouTube Channel',
        email: credential.metadata['accountEmail'] as string | undefined,
        avatarUrl: item?.snippet?.thumbnails?.default?.url,
      };
    } catch {
      return {
        id: (credential.metadata['accountId'] as string) || 'channel',
        name: (credential.metadata['accountName'] as string) || 'YouTube Channel',
      };
    }
  }

  async disconnect(): Promise<void> {
    // Revocation optional
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(): Promise<WebhookProcessResult> {
    return { success: true, eventType: 'none' };
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential?.accessToken) {
      return { success: false, message: 'Missing YouTube access token.' };
    }
    try {
      const res = await axios.get(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${credential.accessToken}` } },
      );
      const items = (res.data as { items?: unknown[] })?.items;
      return {
        success: true,
        message: 'Successfully connected to YouTube API.',
        details: { channelCount: items?.length ?? 0 },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.error?.message || err.message || 'Connection test failed.',
      };
    }
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'search_videos',
        name: 'Search Videos',
        description: 'Search YouTube for videos by query, topic, or keyword.',
        category: 'query',
        parameters: [
          { name: 'query', type: 'string', description: 'Search term or keywords', required: true },
          { name: 'maxResults', type: 'number', description: 'Maximum results (1-50)', required: false, default: 10 },
        ],
      },
      {
        id: 'get_video_details',
        name: 'Get Video Details',
        description: 'Fetch complete statistics, title, description, and tags for a video ID.',
        category: 'query',
        parameters: [
          { name: 'videoId', type: 'string', description: 'The YouTube Video ID', required: true },
        ],
      },
      {
        id: 'get_channel_analytics',
        name: 'Get Channel Analytics',
        description: 'Fetch channel statistics including views, subscribers, and total video count.',
        category: 'query',
        parameters: [
          { name: 'channelId', type: 'string', description: 'Optional channel ID; defaults to authenticated channel', required: false },
        ],
      },
      {
        id: 'update_video_metadata',
        name: 'Update Video Metadata',
        description: 'Update the title, description, category, or tags of a YouTube video.',
        category: 'action',
        confirmationRequired: true,
        parameters: [
          { name: 'videoId', type: 'string', description: 'YouTube video ID', required: true },
          { name: 'title', type: 'string', description: 'New video title', required: false },
          { name: 'description', type: 'string', description: 'New video description', required: false },
          { name: 'tags', type: 'string', description: 'Comma-separated tags', required: false },
        ],
      },
      {
        id: 'get_comments',
        name: 'Get Video Comments',
        description: 'Retrieve top comments on a video for sentiment analysis or engagement.',
        category: 'query',
        parameters: [
          { name: 'videoId', type: 'string', description: 'YouTube video ID', required: true },
          { name: 'maxResults', type: 'number', description: 'Max comments (default 20)', required: false, default: 20 },
        ],
      },
      {
        id: 'reply_comment',
        name: 'Reply to Comment',
        description: 'Post a reply to an existing comment on your video.',
        category: 'action',
        confirmationRequired: true,
        parameters: [
          { name: 'parentId', type: 'string', description: 'Top-level comment ID', required: true },
          { name: 'text', type: 'string', description: 'Comment text reply', required: true },
        ],
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
    _context?: ActionContext,
  ): Promise<AppActionResult> {
    const authHeaders = { Authorization: `Bearer ${credential.accessToken}` };

    if (actionId === 'search_videos') {
      const q = String(input['query'] ?? '');
      const maxResults = Math.min(Number(input['maxResults'] ?? 10), 50);
      const res = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
        { headers: authHeaders },
      );
      const items = (res.data as { items?: any[] })?.items ?? [];
      const videos = items.map((i) => ({
        videoId: i.id?.videoId,
        title: i.snippet?.title,
        description: i.snippet?.description,
        channelTitle: i.snippet?.channelTitle,
        publishedAt: i.snippet?.publishedAt,
        thumbnailUrl: i.snippet?.thumbnails?.high?.url,
      }));
      return { success: true, data: { videos, total: videos.length } };
    }

    if (actionId === 'get_video_details') {
      const videoId = String(input['videoId'] ?? '');
      const res = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}`,
        { headers: authHeaders },
      );
      const item = (res.data as { items?: any[] })?.items?.[0];
      if (!item) {
        return { success: false, error: `Video ${videoId} not found.` };
      }
      return {
        success: true,
        data: {
          videoId,
          title: item.snippet?.title,
          description: item.snippet?.description,
          tags: item.snippet?.tags,
          viewCount: Number(item.statistics?.viewCount ?? 0),
          likeCount: Number(item.statistics?.likeCount ?? 0),
          commentCount: Number(item.statistics?.commentCount ?? 0),
          duration: item.contentDetails?.duration,
        },
      };
    }

    if (actionId === 'get_channel_analytics') {
      const channelId = input['channelId'] ? String(input['channelId']) : null;
      const url = channelId
        ? `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}`
        : `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`;
      const res = await axios.get(url, { headers: authHeaders });
      const item = (res.data as { items?: any[] })?.items?.[0];
      if (!item) {
        return { success: false, error: 'Channel not found.' };
      }
      return {
        success: true,
        data: {
          channelId: item.id,
          title: item.snippet?.title,
          subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
          viewCount: Number(item.statistics?.viewCount ?? 0),
          videoCount: Number(item.statistics?.videoCount ?? 0),
        },
      };
    }

    if (actionId === 'update_video_metadata') {
      const videoId = String(input['videoId'] ?? '');
      // First get snippet
      const getRes = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}`,
        { headers: authHeaders },
      );
      const item = (getRes.data as { items?: any[] })?.items?.[0];
      if (!item) {
        return { success: false, error: `Video ${videoId} not found.` };
      }
      const snippet = item.snippet;
      if (input['title']) snippet.title = String(input['title']);
      if (input['description']) snippet.description = String(input['description']);
      if (input['tags']) {
        snippet.tags = String(input['tags'])
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }

      const updateRes = await axios.put(
        'https://www.googleapis.com/youtube/v3/videos?part=snippet',
        { id: videoId, snippet },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } },
      );
      return {
        success: true,
        data: {
          videoId,
          title: updateRes.data?.snippet?.title,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    if (actionId === 'get_comments') {
      const videoId = String(input['videoId'] ?? '');
      const maxResults = Math.min(Number(input['maxResults'] ?? 20), 100);
      const res = await axios.get(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=${maxResults}&order=relevance`,
        { headers: authHeaders },
      );
      const items = (res.data as { items?: any[] })?.items ?? [];
      const comments = items.map((i) => ({
        commentId: i.id,
        author: i.snippet?.topLevelComment?.snippet?.authorDisplayName,
        text: i.snippet?.topLevelComment?.snippet?.textDisplay,
        likeCount: i.snippet?.topLevelComment?.snippet?.likeCount,
        publishedAt: i.snippet?.topLevelComment?.snippet?.publishedAt,
      }));
      return { success: true, data: { comments, count: comments.length } };
    }

    if (actionId === 'reply_comment') {
      const parentId = String(input['parentId'] ?? '');
      const text = String(input['text'] ?? '');
      const res = await axios.post(
        'https://www.googleapis.com/youtube/v3/comments?part=snippet',
        {
          snippet: {
            parentId,
            textOriginal: text,
          },
        },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } },
      );
      return {
        success: true,
        data: {
          commentId: res.data?.id,
          text,
          publishedAt: res.data?.snippet?.publishedAt,
        },
      };
    }

    throw new BadRequestException(`Unknown YouTube action: '${actionId}'`);
  }

  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_video',
        name: 'New Video Uploaded',
        description: 'Triggers when a new video is published on your YouTube channel.',
        pollActionId: 'search_videos',
        pollIntervalSeconds: 300,
        eventSchema: { videoId: 'string', title: 'string', publishedAt: 'string' },
      },
    ];
  }
}
