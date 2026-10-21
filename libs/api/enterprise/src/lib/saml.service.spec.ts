import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import * as zlib from 'node:zlib';
import { SamlService } from './saml.service.js';

describe('SamlService', () => {
  const samlService = new SamlService();

  describe('SP Metadata Generation', () => {
    it('generates standard SAML 2.0 SP metadata XML', () => {
      const spEntityId = 'https://app.mie.ai/api/v1/auth/sso/saml/metadata/org-123';
      const acsUrl = 'https://app.mie.ai/api/v1/auth/sso/saml/acs/org-123';

      const xml = samlService.generateSpMetadata({ spEntityId, acsUrl });

      expect(xml).toContain('md:EntityDescriptor');
      expect(xml).toContain(`entityID="${spEntityId}"`);
      expect(xml).toContain(`Location="${acsUrl}"`);
      expect(xml).toContain('urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST');
      expect(xml).toContain('NameIDFormat');

      // Ensure XML is well-formed
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const root = doc.documentElement;
      expect(root.tagName).toBe('md:EntityDescriptor');
      expect(root.getAttribute('entityID')).toBe(spEntityId);
    });
  });

  describe('AuthnRequest Generation', () => {
    it('generates a valid AuthnRequest with deflate-raw and base64 encoding', () => {
      const spEntityId = 'https://app.mie.ai/api/v1/auth/sso/saml/metadata/org-123';
      const acsUrl = 'https://app.mie.ai/api/v1/auth/sso/saml/acs/org-123';
      const idpSsoUrl = 'https://login.microsoftonline.com/tenant-123/saml2';

      const { requestId, url } = samlService.buildAuthnRequest({
        spEntityId,
        acsUrl,
        ssoUrl: idpSsoUrl,
        forceAuthn: true,
        relayState: 'org-123',
      });

      expect(requestId.startsWith('_')).toBe(true);

      // Verify URL contains SAMLRequest and RelayState query parameters
      const parsedUrl = new URL(url);
      expect(parsedUrl.origin + parsedUrl.pathname).toBe(idpSsoUrl);
      const samlParam = parsedUrl.searchParams.get('SAMLRequest');
      expect(samlParam).toBeDefined();

      // Decompress SAMLRequest parameter to verify deflate-raw
      const compressedBuffer = Buffer.from(decodeURIComponent(samlParam!), 'base64');
      const decompressed = zlib.inflateRawSync(compressedBuffer).toString('utf8');
      expect(decompressed).toContain('<samlp:AuthnRequest');
      expect(decompressed).toContain(`ID="${requestId}"`);
      expect(decompressed).toContain(`Destination="${idpSsoUrl}"`);
      expect(decompressed).toContain(`AssertionConsumerServiceURL="${acsUrl}"`);
      expect(decompressed).toContain('ForceAuthn="true"');
      expect(decompressed).toContain(`<saml:Issuer>${spEntityId}</saml:Issuer>`);

      // Verify RelayState
      expect(parsedUrl.searchParams.get('RelayState')).toBe('org-123');
    });
  });

  describe('SAML Response Validation', () => {
    it('throws error when SAML response is missing or empty', async () => {
      await expect(
        samlService.validateSamlResponse({
          samlResponseBase64: '',
          expectedAudience: 'https://app.mie.ai',
          certificatePem: 'MIIC...',
        }),
      ).rejects.toThrow();
    });

    it('rejects malformed XML in SAML response', async () => {
      const invalidBase64 = Buffer.from('not valid xml <<<').toString('base64');
      await expect(
        samlService.validateSamlResponse({
          samlResponseBase64: invalidBase64,
          expectedAudience: 'https://app.mie.ai',
          certificatePem: 'MIIC...',
        }),
      ).rejects.toThrow();
    });

    it('rejects unsigned SAML responses for security enforcement', async () => {
      const mockSamlXml = `
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_123">
          <saml:Issuer>https://idp.example.com</saml:Issuer>
          <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
          <saml:Assertion ID="_assert_1">
            <saml:Issuer>https://idp.example.com</saml:Issuer>
            <saml:Subject>
              <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">alice@example.com</saml:NameID>
            </saml:Subject>
          </saml:Assertion>
        </samlp:Response>
      `;

      const b64 = Buffer.from(mockSamlXml, 'utf8').toString('base64');

      await expect(
        samlService.validateSamlResponse({
          samlResponseBase64: b64,
          expectedAudience: 'https://app.mie.ai/sp',
          certificatePem: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
        }),
      ).rejects.toThrow('SAML response or assertion is unsigned. A signed response is required.');
    });
  });
});
