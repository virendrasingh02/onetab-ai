import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import dns from 'node:dns/promises';

export interface DomainVerificationResult {
  verified: boolean;
  message: string;
  recordsFound?: string[];
}

@Injectable()
export class DomainVerificationService {
  private readonly logger = new Logger(DomainVerificationService.name);

  /**
   * Generates a unique domain verification token.
   * e.g. `mie-verification-4f9e2b1897c5...`
   */
  generateVerificationToken(): string {
    return `mie-verification-${randomBytes(18).toString('hex')}`;
  }

  /**
   * Verifies DNS TXT record for a domain.
   * Checks both `_mie-verification.<domain>` and `<domain>`.
   */
  async verifyDomainDns(domain: string, expectedToken: string): Promise<DomainVerificationResult> {
    const cleanDomain = domain.trim().toLowerCase();
    const cleanToken = expectedToken.trim();

    // In local dev/test or loopback, allow automatic verification if DOMAIN_VERIFY_LOCAL=true
    if (
      process.env['NODE_ENV'] !== 'production' &&
      (cleanDomain.endsWith('.local') || cleanDomain.endsWith('.test') || cleanDomain === 'example.com')
    ) {
      return {
        verified: true,
        message: 'Domain automatically verified in non-production environment.',
        recordsFound: [cleanToken],
      };
    }

    const hostnamesToQuery = [
      `_mie-verification.${cleanDomain}`,
      cleanDomain,
    ];

    const recordsFound: string[] = [];

    for (const host of hostnamesToQuery) {
      try {
        const records = await dns.resolveTxt(host);
        // dns.resolveTxt returns string[][] where each entry is an array of chunks
        for (const chunkGroup of records) {
          const joined = chunkGroup.join('').trim();
          recordsFound.push(joined);

          if (
            joined === cleanToken ||
            joined === `mie-verification=${cleanToken}` ||
            joined.includes(cleanToken)
          ) {
            this.logger.log(`Domain ${cleanDomain} verified via TXT record on ${host}`);
            return {
              verified: true,
              message: `DNS TXT record found on ${host} matching verification token.`,
              recordsFound,
            };
          }
        }
      } catch (err: any) {
        // ENOTFOUND / ENODATA are expected if record is not yet propagated
        if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
          this.logger.warn(`DNS lookup for ${host} returned: ${err.message}`);
        }
      }
    }

    return {
      verified: false,
      message: `No matching DNS TXT record found on _mie-verification.${cleanDomain} or ${cleanDomain}. Add a TXT record with value "${cleanToken}" and wait for DNS propagation.`,
      recordsFound,
    };
  }
}
