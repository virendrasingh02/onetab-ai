import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  assertPublicHttpUrl,
  createPublicOnlyAgents,
  isPrivateOrReservedIp,
  UnsafeUrlError,
} from '@org/api-common';

/**
 * Nest-facing adapter over the shared SSRF guard in `@org/api-common`: same
 * checks, reported as HTTP exceptions (400 for input that is not a usable
 * URL, 403 for a destination that is refused).
 */
@Injectable()
export class SSRFGuardService {
  private readonly logger = new Logger(SSRFGuardService.name);

  /** Agents that refuse private addresses at connect time (DNS rebinding). */
  readonly agents = createPublicOnlyAgents();

  /**
   * Validates a URL string for SSRF vulnerabilities.
   * Throws ForbiddenException or BadRequestException if the destination is unsafe.
   */
  async validateUrl(urlString: string): Promise<URL> {
    if (!urlString || typeof urlString !== 'string') {
      throw new BadRequestException('Target URL is required.');
    }
    try {
      return await assertPublicHttpUrl(urlString);
    } catch (err) {
      if (!(err instanceof UnsafeUrlError)) throw err;
      if (err.reason === 'invalid' || err.reason === 'dns') {
        throw new BadRequestException(err.message);
      }
      this.logger.warn(`SSRF Block: ${err.message}`);
      throw new ForbiddenException(err.message);
    }
  }

  /** Whether an IPv4/IPv6 address is private, loopback or reserved. */
  isPrivateOrReservedIp(ip: string): boolean {
    return isPrivateOrReservedIp(ip);
  }
}
