import { Injectable } from '@nestjs/common';
import type {
  EmailTemplateDefinition,
  RenderedTemplateResult,
  WorkspaceBranding,
} from '@org/types';
import { EmailLayout } from '../components/index.js';
import { resolveVariables } from '../variables/index.js';

/**
 * Base URL the built-in template definitions use for fallback links
 * (`{{x.url || "http://localhost:4200/..."}}`). Rendering rebases it onto the
 * deployment's `APP_URL` so production mail never links to localhost.
 */
export const TEMPLATE_BASE_URL = 'http://localhost:4200';

export interface RenderTemplateOptions {
  data: Record<string, unknown>;
  branding?: WorkspaceBranding;
  timezone?: string;
  locale?: string;
  /** Public web origin (APP_URL); replaces {@link TEMPLATE_BASE_URL}. */
  appUrl?: string;
}

function rebase(source: string, appUrl?: string): string {
  if (!appUrl || appUrl === TEMPLATE_BASE_URL) return source;
  return source.split(TEMPLATE_BASE_URL).join(appUrl.replace(/\/+$/, ''));
}

@Injectable()
export class TemplateRenderer {
  /**
   * Complete transactional email rendering pipeline:
   * 1. Interpolates variables and conditionals into subject line
   * 2. Interpolates variables into preview text
   * 3. Interpolates variables into HTML body
   * 4. Interpolates variables into Plain-Text body (or derives from HTML)
   * 5. Wraps HTML in branded EmailLayout with workspace logo, colors and footer
   */
  render(
    source: EmailTemplateDefinition,
    options: RenderTemplateOptions,
  ): RenderedTemplateResult {
    const { data, branding, timezone, locale, appUrl } = options;
    const template: EmailTemplateDefinition = {
      ...source,
      htmlBody: rebase(source.htmlBody, appUrl),
      textBody: source.textBody ? rebase(source.textBody, appUrl) : source.textBody,
    };
    const resolveOpts = { timezone, locale, escape: true };

    // Inject branding shortcuts into template data if not already provided
    const mergedData: Record<string, unknown> = {
      appName: branding?.workspaceName || 'OneTab AI',
      workspace: {
        name: branding?.workspaceName || 'OneTab AI',
        logo: branding?.workspaceLogo,
        ...(data.workspace && typeof data.workspace === 'object' ? data.workspace : {}),
      },
      ...data,
    };

    // 1. Resolve subject line (no HTML escaping in subject line!)
    const subject = resolveVariables(template.subject, mergedData, {
      ...resolveOpts,
      escape: false,
    });

    // 2. Resolve preview text (preheader)
    const previewText = template.previewText
      ? resolveVariables(template.previewText, mergedData, {
          ...resolveOpts,
          escape: false,
        })
      : undefined;

    // 3. Resolve inner HTML body
    const innerHtml = resolveVariables(template.htmlBody, mergedData, resolveOpts);

    // 4. Wrap with EmailLayout and apply workspace branding
    const finalHtml = EmailLayout(innerHtml, {
      appName: branding?.workspaceName,
      preheader: previewText,
      branding: {
        workspaceName: branding?.workspaceName,
        workspaceLogo: branding?.workspaceLogo,
        primaryColor: branding?.primaryColor,
        customFooter: branding?.customFooter,
      },
      footerOptions: {
        appName: branding?.workspaceName,
        customFooter: branding?.customFooter,
      },
    });

    // 5. Generate plain-text equivalent
    let plainText: string;
    if (template.textBody) {
      plainText = resolveVariables(template.textBody, mergedData, {
        ...resolveOpts,
        escape: false,
      });
    } else {
      // Clean HTML tags to generate sensible plain-text fallback
      plainText = innerHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n\s+\n/g, '\n\n')
        .trim();
    }

    return {
      subject,
      html: finalHtml,
      text: plainText,
      previewText,
    };
  }

  /**
   * Helper to render template preview using schema sample payload or provided sample data.
   */
  renderPreview(
    template: EmailTemplateDefinition,
    sampleData?: Record<string, unknown>,
    branding?: WorkspaceBranding,
  ): RenderedTemplateResult {
    const data = sampleData || template.variablesSchema?.samplePayload || {};
    return this.render(template, {
      data,
      branding: {
        workspaceName: branding?.workspaceName || (data.workspace as any)?.name || 'OneTab AI',
        ...branding,
      },
    });
  }
}

