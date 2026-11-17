import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { YouTubeProvider } from './youtube.provider.js';
import { LinkedInProvider } from './linkedin.provider.js';
import { InstagramProvider } from './instagram.provider.js';

describe('Social Media Connectors (YouTube, LinkedIn, Instagram)', () => {
  const config = new ConfigService({
    YOUTUBE_CLIENT_ID: 'mock_yt_client_id',
    YOUTUBE_CLIENT_SECRET: 'mock_yt_client_secret',
    LINKEDIN_CLIENT_ID: 'mock_li_client_id',
    LINKEDIN_CLIENT_SECRET: 'mock_li_client_secret',
    INSTAGRAM_CLIENT_ID: 'mock_ig_client_id',
    INSTAGRAM_CLIENT_SECRET: 'mock_ig_client_secret',
  });

  it('declares valid YouTube capabilities and actions', () => {
    const yt = new YouTubeProvider(config);
    const caps = yt.getCapabilities();
    expect(caps.provider).toBe('YOUTUBE');
    expect(caps.displayName).toBe('YouTube');

    const actions = yt.getActions();
    const actionIds = actions.map((a) => a.id);
    expect(actionIds).toContain('search_videos');
    expect(actionIds).toContain('get_video_details');
    expect(actionIds).toContain('get_channel_analytics');
    expect(actionIds).toContain('update_video_metadata');
    expect(actionIds).toContain('reply_comment');

    const triggers = yt.getTriggers();
    expect(triggers.some((t) => t.id === 'new_video')).toBe(true);
  });

  it('declares valid LinkedIn capabilities and actions', () => {
    const li = new LinkedInProvider(config);
    const caps = li.getCapabilities();
    expect(caps.provider).toBe('LINKEDIN');
    expect(caps.displayName).toBe('LinkedIn');

    const actions = li.getActions();
    const actionIds = actions.map((a) => a.id);
    expect(actionIds).toContain('get_profile');
    expect(actionIds).toContain('create_post');
    expect(actionIds).toContain('get_post_analytics');
    expect(actionIds).toContain('get_comments');
    expect(actionIds).toContain('reply_comment');
  });

  it('declares valid Instagram capabilities and actions', () => {
    const ig = new InstagramProvider(config);
    const caps = ig.getCapabilities();
    expect(caps.provider).toBe('INSTAGRAM');
    expect(caps.displayName).toBe('Instagram');

    const actions = ig.getActions();
    const actionIds = actions.map((a) => a.id);
    expect(actionIds).toContain('get_profile_insights');
    expect(actionIds).toContain('publish_media');
    expect(actionIds).toContain('get_media_insights');
    expect(actionIds).toContain('get_comments');
    expect(actionIds).toContain('reply_comment');
  });

  it('generates authorization URLs for OAuth flows', async () => {
    const yt = new YouTubeProvider(config);
    const ytUrl = await yt.getAuthorizationUrl('state_yt');
    expect(ytUrl).toContain('accounts.google.com');
    expect(ytUrl).toContain('mock_yt_client_id');

    const li = new LinkedInProvider(config);
    const liUrl = await li.getAuthorizationUrl('state_li');
    expect(liUrl).toContain('linkedin.com/oauth/v2/authorization');
    expect(liUrl).toContain('mock_li_client_id');

    const ig = new InstagramProvider(config);
    const igUrl = await ig.getAuthorizationUrl('state_ig');
    expect(igUrl).toContain('facebook.com');
    expect(igUrl).toContain('mock_ig_client_id');
  });
});
