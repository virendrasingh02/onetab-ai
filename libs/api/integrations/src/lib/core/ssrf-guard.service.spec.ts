import { describe, expect, it } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { SSRFGuardService } from './ssrf-guard.service.js';

describe('SSRFGuardService', () => {
  const service = new SSRFGuardService();

  describe('isPrivateOrReservedIp', () => {
    it('identifies private IPv4 addresses', () => {
      expect(service.isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(service.isPrivateOrReservedIp('10.0.0.1')).toBe(true);
      expect(service.isPrivateOrReservedIp('192.168.1.100')).toBe(true);
      expect(service.isPrivateOrReservedIp('172.16.0.5')).toBe(true);
      expect(service.isPrivateOrReservedIp('172.31.255.255')).toBe(true);
      expect(service.isPrivateOrReservedIp('169.254.169.254')).toBe(true);
      expect(service.isPrivateOrReservedIp('0.0.0.0')).toBe(true);
    });

    it('identifies public IPv4 addresses as safe', () => {
      expect(service.isPrivateOrReservedIp('8.8.8.8')).toBe(false);
      expect(service.isPrivateOrReservedIp('1.1.1.1')).toBe(false);
      expect(service.isPrivateOrReservedIp('142.250.190.46')).toBe(false);
    });

    it('identifies private and loopback IPv6 addresses', () => {
      expect(service.isPrivateOrReservedIp('::1')).toBe(true);
      expect(service.isPrivateOrReservedIp('::')).toBe(true);
      expect(service.isPrivateOrReservedIp('fe80::1')).toBe(true);
      expect(service.isPrivateOrReservedIp('fc00::1')).toBe(true);
      expect(service.isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
      expect(service.isPrivateOrReservedIp('::ffff:10.0.0.1')).toBe(true);
    });
  });

  describe('validateUrl', () => {
    it('rejects invalid or non-http protocols', async () => {
      await expect(service.validateUrl('ftp://example.com/file')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('file:///etc/passwd')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('javascript:alert(1)')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('invalid-url-format')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects direct private IP destinations', async () => {
      await expect(service.validateUrl('http://127.0.0.1:3000')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('http://10.0.0.1/admin')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('http://192.168.1.1/router')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects dangerous internal hostnames', async () => {
      await expect(service.validateUrl('http://localhost:8080')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('http://metadata.google.internal/computeMetadata/v1')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUrl('http://app.internal/api')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows valid public HTTPS URLs', async () => {
      const parsed = await service.validateUrl('https://api.github.com/users');
      expect(parsed.hostname).toBe('api.github.com');
      expect(parsed.protocol).toBe('https:');
    });
  });
});
