import { Injectable, Logger } from '@nestjs/common';
import { generateToken } from '@org/api-common';

/**
 * Short-lived, single-use tickets for opening the SSE stream.
 *
 * The browser `EventSource` API cannot set an `Authorization` header, so the
 * stream used to take the raw access token as `?token=` — which then lands in
 * the API's access logs and any proxy in between. A client now trades its
 * bearer token (over a normal authenticated `POST`) for one of these tickets
 * and puts *that* in the URL: it is meaningless after ~30s and after the one
 * `GET /realtime/stream` that redeems it.
 */
const TICKET_TTL_MS = 30_000;

interface PendingTicket {
  userId: string;
  workspaceId: string | null;
  expiresAt: number;
}

@Injectable()
export class RealtimeTicketService {
  private readonly logger = new Logger(RealtimeTicketService.name);
  private readonly tickets = new Map<string, PendingTicket>();

  constructor() {
    setInterval(() => this.prune(), TICKET_TTL_MS).unref();
  }

  issue(
    userId: string,
    workspaceId: string | null,
  ): { ticket: string; expiresIn: number } {
    const ticket = generateToken(32);
    this.tickets.set(ticket, {
      userId,
      workspaceId,
      expiresAt: Date.now() + TICKET_TTL_MS,
    });
    return { ticket, expiresIn: Math.floor(TICKET_TTL_MS / 1000) };
  }

  /** One-time redemption: removed on read, `null` if unknown or expired. */
  consume(ticket: string): PendingTicket | null {
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    this.tickets.delete(ticket);
    if (Date.now() > entry.expiresAt) {
      this.logger.debug('Rejected an expired realtime stream ticket');
      return null;
    }
    return entry;
  }

  private prune(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.tickets.entries()) {
      if (now > entry.expiresAt) this.tickets.delete(ticket);
    }
  }
}
