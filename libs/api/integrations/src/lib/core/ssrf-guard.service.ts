import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';

@Injectable()
export class SSRFGuardService {
  private readonly logger = new Logger(SSRFGuardService.name);

  /**
   * Blocked hostnames known to belong to cloud metadata or internal services.
   */
  private readonly blockedHostnames = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata.goog',
    'instance-data',
    '169.254.169.254',
  ]);

  /**
   * Validates a URL string for SSRF vulnerabilities.
   * Throws ForbiddenException or BadRequestException if the destination is unsafe.
   */
  async validateUrl(urlString: string): Promise<URL> {
    if (!urlString || typeof urlString !== 'string') {
      throw new BadRequestException('Target URL is required.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlString.trim());
    } catch {
      throw new BadRequestException('Invalid URL format.');
    }

    // Protocol check: only HTTP and HTTPS are permitted
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new ForbiddenException(
        `Protocol '${parsedUrl.protocol}' is not permitted. Only HTTP and HTTPS are allowed.`,
      );
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Check blocked hostnames
    if (this.blockedHostnames.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
      this.logger.warn(`SSRF Block: Denied connection to restricted hostname '${hostname}'`);
      throw new ForbiddenException(
        `Destination hostname '${hostname}' is restricted for security.`,
      );
    }

    // If hostname is directly an IP address, validate it immediately
    if (net.isIP(hostname)) {
      if (this.isPrivateOrReservedIp(hostname)) {
        this.logger.warn(`SSRF Block: Denied connection to private IP '${hostname}'`);
        throw new ForbiddenException(
          `Destination IP address '${hostname}' is private or reserved and cannot be accessed.`,
        );
      }
      return parsedUrl;
    }

    // Resolve DNS hostname to prevent DNS rebinding attacks
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        throw new BadRequestException(`Could not resolve hostname '${hostname}'.`);
      }

      for (const record of records) {
        if (this.isPrivateOrReservedIp(record.address)) {
          this.logger.warn(
            `SSRF Block: Hostname '${hostname}' resolved to private IP '${record.address}'`,
          );
          throw new ForbiddenException(
            `Destination '${hostname}' resolves to a restricted private IP address.`,
          );
        }
      }
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.warn(`DNS lookup failure for '${hostname}': ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException(`Failed to resolve destination hostname '${hostname}'.`);
    }

    return parsedUrl;
  }

  /**
   * Checks whether an IPv4 or IPv6 address is in a private, loopback, or reserved range.
   */
  isPrivateOrReservedIp(ip: string): boolean {
    const version = net.isIP(ip);
    if (version === 4) {
      return this.isPrivateOrReservedIpv4(ip);
    }
    if (version === 6) {
      return this.isPrivateOrReservedIpv6(ip);
    }
    return true; // Unknown format, fail closed
  }

  private isPrivateOrReservedIpv4(ip: string): boolean {
    const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 10.0.0.0/8 (Private network)
    if (a === 10) return true;

    // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (Link-local, AWS/GCP instance metadata)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;

    // 192.168.0.0/16 (Private network)
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 (Network benchmark tests)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;

    // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved for future use: 240.0.0.0 - 255.255.255.254)
    if (a >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    return false;
  }

  private isPrivateOrReservedIpv6(ip: string): boolean {
    const normalized = ip.toLowerCase();

    // ::1 (Loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

    // :: (Unspecified)
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    if (normalized.startsWith('::ffff:')) {
      const ipv4Part = normalized.substring(7);
      if (net.isIPv4(ipv4Part)) {
        return this.isPrivateOrReservedIpv4(ipv4Part);
      }
    }

    // fe80::/10 (Link-local)
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true;
    }

    // fc00::/7 (Unique local address: fc00:: to fdff::)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
      return true;
    }

    return false;
  }
}
