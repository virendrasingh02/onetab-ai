/** Email-to-channel (brief §5) — DTOs shared by API and web. */

export interface ChannelEmailSettingsView {
  channelId: string;
  /** Full address, e.g. `acme-general-a1b2c3@inbound.onetab.ai`, or null when
   *  the deployment has no inbound-email domain configured. */
  address: string | null;
  isEnabled: boolean;
  threadPerSubject: boolean;
  /** Count of emails routed into this channel so far. */
  messageCount: number;
}

/** A hint carried on Matrix messages that originated from an inbound email. */
export const EMAIL_EVENT_KEY = 'org.onetab.email';

export interface EmailEventHint {
  from: string;
  fromName?: string;
  subject?: string;
  messageId: string;
}
