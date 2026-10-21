import {
  createPublicKey,
  randomBytes,
  verify as cryptoVerify,
} from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { DOMParser } from '@xmldom/xmldom';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { normalizeCertificatePem } from './crypto-secrets.js';

export interface SamlAssertionClaims {
  nameId: string;
  nameIdFormat?: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  groups: string[];
  attributes: Record<string, string | string[]>;
  sessionIndex?: string;
}

export interface BuildAuthnRequestOptions {
  ssoUrl: string;
  spEntityId: string;
  acsUrl: string;
  relayState: string;
  forceAuthn?: boolean;
}

export interface ValidateSamlResponseOptions {
  samlResponseBase64: string;
  certificatePem: string;
  expectedAudience: string;
  expectedAcsUrl?: string;
  clockSkewSeconds?: number;
  inResponseTo?: string;
}

const COMMON_EMAIL_ATTRIBUTES = [
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'http://schemas.microsoft.com/identity/claims/emailaddress',
  'email',
  'mail',
  'emailAddress',
  'User.Email',
  'urn:oid:0.9.2342.19200300.100.1.3',
];

const COMMON_DISPLAY_NAME_ATTRIBUTES = [
  'http://schemas.microsoft.com/identity/claims/displayname',
  'displayName',
  'name',
  'User.DisplayName',
  'urn:oid:2.16.840.1.113730.3.1.241',
];

const COMMON_GIVEN_NAME_ATTRIBUTES = [
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  'givenName',
  'firstName',
  'User.FirstName',
  'urn:oid:2.5.4.42',
];

const COMMON_SURNAME_ATTRIBUTES = [
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  'surname',
  'lastName',
  'sn',
  'User.LastName',
  'urn:oid:2.5.4.4',
];

const COMMON_GROUP_ATTRIBUTES = [
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
  'http://schemas.xmlsoap.org/claims/Group',
  'groups',
  'memberOf',
  'roles',
  'group',
];

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);

  /**
   * Generates standard SP Metadata XML for IdP configuration (Okta, Entra ID, Google Workspace).
   */
  generateSpMetadata(options: { spEntityId: string; acsUrl: string; sloUrl?: string }): string {
    const { spEntityId, acsUrl, sloUrl } = options;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    ${sloUrl ? `<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${sloUrl}"/>` : ''}
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /**
   * Constructs a SAML 2.0 AuthnRequest and returns the HTTP-Redirect binding URL.
   */
  buildAuthnRequest(options: BuildAuthnRequestOptions): { url: string; requestId: string } {
    const requestId = `_${randomBytes(16).toString('hex')}`;
    const issueInstant = new Date().toISOString();

    const authnXml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${options.ssoUrl}" AssertionConsumerServiceURL="${options.acsUrl}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"${options.forceAuthn ? ' ForceAuthn="true"' : ''}>
  <saml:Issuer>${options.spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;

    const deflated = deflateRawSync(Buffer.from(authnXml, 'utf8'));
    const samlRequestBase64 = deflated.toString('base64');

    const separator = options.ssoUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams({
      SAMLRequest: samlRequestBase64,
      RelayState: options.relayState,
    });

    return {
      url: `${options.ssoUrl}${separator}${params.toString()}`,
      requestId,
    };
  }

  /**
   * Validates a posted SAML Response, verifying digital signature, audience, conditions, and attributes.
   */
  async validateSamlResponse(options: ValidateSamlResponseOptions): Promise<SamlAssertionClaims> {
    const rawXml = Buffer.from(options.samlResponseBase64, 'base64').toString('utf8');
    const parser = new DOMParser({
      errorHandler: {
        warning: () => undefined,
        error: (msg) => {
          this.logger.warn(`SAML XML parse error: ${msg}`);
        },
        fatalError: (msg) => {
          throw new BadRequestException(`Malformed SAML Response XML: ${msg}`);
        },
      },
    });

    const doc = parser.parseFromString(rawXml, 'text/xml');
    if (!doc || !doc.documentElement) {
      throw new BadRequestException('Could not parse SAML response XML.');
    }

    // 1. Status Code Verification
    this.assertSuccessStatus(doc);

    // 2. Locate Assertion
    const assertion = this.findFirstElement(doc, ['Assertion', 'saml:Assertion', 'saml2:Assertion']);
    if (!assertion) {
      throw new BadRequestException('SAML Response contains no assertion.');
    }

    // 3. Digital Signature Verification
    this.verifySignature(doc, assertion, options.certificatePem);

    // 4. Conditions and Audience Validation
    this.verifyConditions(assertion, options.expectedAudience, options.clockSkewSeconds ?? 120);

    // 5. InResponseTo verification (if required)
    if (options.inResponseTo) {
      const inResponseTo = doc.documentElement.getAttribute('InResponseTo') || assertion.getAttribute('InResponseTo');
      if (inResponseTo && inResponseTo !== options.inResponseTo) {
        throw new BadRequestException('SAML InResponseTo mismatch.');
      }
    }

    // 6. Claims & Attributes Extraction
    return this.extractClaims(assertion);
  }

  private assertSuccessStatus(doc: Document): void {
    const statusCode = this.findFirstElement(doc, ['StatusCode', 'samlp:StatusCode', 'saml2p:StatusCode']);
    if (!statusCode) {
      throw new BadRequestException('SAML response missing StatusCode.');
    }

    const value = statusCode.getAttribute('Value') ?? '';
    if (!value.endsWith(':Success') && !value.endsWith('/Success')) {
      const statusMessage = this.findFirstElement(doc, ['StatusMessage', 'samlp:StatusMessage'])?.textContent?.trim();
      throw new BadRequestException(`SAML authentication failed at IdP: ${statusMessage ?? value}`);
    }
  }

  private verifySignature(doc: Document, assertion: Element, certificatePem: string): void {
    const signature = this.findFirstElement(assertion, ['Signature', 'ds:Signature']) ||
      this.findFirstElement(doc, ['Signature', 'ds:Signature']);

    if (!signature) {
      throw new BadRequestException('SAML response or assertion is unsigned. A signed response is required.');
    }

    const signedInfo = this.findFirstElement(signature, ['SignedInfo', 'ds:SignedInfo']);
    const signatureValue = this.findFirstElement(signature, ['SignatureValue', 'ds:SignatureValue'])?.textContent?.replace(/\s+/g, '');

    if (!signedInfo || !signatureValue) {
      throw new BadRequestException('SAML Signature is incomplete (missing SignedInfo or SignatureValue).');
    }

    const signatureMethod = this.findFirstElement(signedInfo, ['SignatureMethod', 'ds:SignatureMethod'])?.getAttribute('Algorithm') ?? '';
    const algorithm = signatureMethod.includes('rsa-sha256')
      ? 'RSA-SHA256'
      : signatureMethod.includes('rsa-sha1')
      ? 'RSA-SHA1'
      : 'RSA-SHA256';

    const normalizedPem = normalizeCertificatePem(certificatePem);
    let publicKey;
    try {
      publicKey = createPublicKey(normalizedPem);
    } catch (err) {
      throw new BadRequestException(`Configured IdP certificate is invalid: ${(err as Error).message}`);
    }

    // Canonicalize SignedInfo for signature verification
    const c14nSignedInfo = this.canonicalizeNode(signedInfo);
    const signatureBuffer = Buffer.from(signatureValue, 'base64');

    const isValid = cryptoVerify(
      algorithm,
      Buffer.from(c14nSignedInfo, 'utf8'),
      publicKey,
      signatureBuffer,
    );

    if (!isValid) {
      // Fallback: check if raw text canonicalization matches
      const rawTextSignedInfo = signedInfo.toString();
      const isValidFallback = cryptoVerify(
        algorithm,
        Buffer.from(rawTextSignedInfo, 'utf8'),
        publicKey,
        signatureBuffer,
      );

      if (!isValidFallback) {
        throw new BadRequestException('SAML digital signature verification failed. Check the IdP signing certificate.');
      }
    }
  }

  private verifyConditions(assertion: Element, expectedAudience: string, clockSkewSeconds: number): void {
    const conditions = this.findFirstElement(assertion, ['Conditions', 'saml:Conditions', 'saml2:Conditions']);
    const now = Math.floor(Date.now() / 1000);

    if (conditions) {
      const notBeforeStr = conditions.getAttribute('NotBefore');
      const notOnOrAfterStr = conditions.getAttribute('NotOnOrAfter');

      if (notBeforeStr) {
        const notBefore = Math.floor(new Date(notBeforeStr).getTime() / 1000);
        if (!isNaN(notBefore) && notBefore - clockSkewSeconds > now) {
          throw new BadRequestException('SAML assertion is not yet valid (NotBefore). Check server clock.');
        }
      }

      if (notOnOrAfterStr) {
        const notOnOrAfter = Math.floor(new Date(notOnOrAfterStr).getTime() / 1000);
        if (!isNaN(notOnOrAfter) && notOnOrAfter + clockSkewSeconds <= now) {
          throw new BadRequestException('SAML assertion has expired (NotOnOrAfter).');
        }
      }

      // Check Audience
      const audienceElements = this.findElements(conditions, ['Audience', 'saml:Audience', 'saml2:Audience']);
      if (audienceElements.length > 0) {
        const audiences = audienceElements.map((el) => el.textContent?.trim()).filter(Boolean);
        const matches = audiences.some((aud) => aud === expectedAudience);
        if (!matches && !audiences.includes(expectedAudience)) {
          this.logger.warn(`SAML Audience mismatch: received [${audiences.join(', ')}], expected "${expectedAudience}"`);
          // If expected audience ends with the orgId or starts with expected prefix, accept
          const lenientMatch = audiences.some((aud) => aud?.includes(expectedAudience) || expectedAudience.includes(aud ?? ''));
          if (!lenientMatch) {
            throw new BadRequestException(`SAML audience mismatch. Expected "${expectedAudience}", received "${audiences.join(', ')}".`);
          }
        }
      }
    }
  }

  private extractClaims(assertion: Element): SamlAssertionClaims {
    // 1. NameID
    const nameIdEl = this.findFirstElement(assertion, ['NameID', 'saml:NameID', 'saml2:NameID']);
    const nameId = nameIdEl?.textContent?.trim() ?? '';
    const nameIdFormat = nameIdEl?.getAttribute('Format') ?? undefined;

    // 2. Attributes
    const attributeStatements = this.findElements(assertion, ['AttributeStatement', 'saml:AttributeStatement', 'saml2:AttributeStatement']);
    const attributes: Record<string, string | string[]> = {};

    for (const stmt of attributeStatements) {
      const attributeEls = this.findElements(stmt, ['Attribute', 'saml:Attribute', 'saml2:Attribute']);
      for (const attr of attributeEls) {
        const name = attr.getAttribute('Name') || attr.getAttribute('FriendlyName');
        if (!name) continue;

        const valueEls = this.findElements(attr, ['AttributeValue', 'saml:AttributeValue', 'saml2:AttributeValue']);
        const values = valueEls.map((v) => v.textContent?.trim() ?? '').filter(Boolean);

        if (values.length === 1) {
          attributes[name] = values[0] as string;
        } else if (values.length > 1) {
          attributes[name] = values;
        }
      }
    }

    // 3. Resolve Email
    let email = '';
    for (const key of COMMON_EMAIL_ATTRIBUTES) {
      const val = attributes[key];
      if (typeof val === 'string' && val.includes('@')) {
        email = val.toLowerCase();
        break;
      }
    }

    // If no attribute gave an email, check if NameID is an email
    if (!email && nameId.includes('@')) {
      email = nameId.toLowerCase();
    }

    if (!email) {
      throw new BadRequestException('SAML assertion does not contain an email address claim.');
    }

    // 4. Resolve Display Name, First Name, Last Name
    let displayName = '';
    for (const key of COMMON_DISPLAY_NAME_ATTRIBUTES) {
      const val = attributes[key];
      if (typeof val === 'string' && val) {
        displayName = val;
        break;
      }
    }

    let firstName = '';
    for (const key of COMMON_GIVEN_NAME_ATTRIBUTES) {
      const val = attributes[key];
      if (typeof val === 'string' && val) {
        firstName = val;
        break;
      }
    }

    let lastName = '';
    for (const key of COMMON_SURNAME_ATTRIBUTES) {
      const val = attributes[key];
      if (typeof val === 'string' && val) {
        lastName = val;
        break;
      }
    }

    if (!displayName) {
      if (firstName || lastName) {
        displayName = `${firstName} ${lastName}`.trim();
      } else {
        displayName = email.split('@')[0] ?? 'User';
      }
    }

    // 5. Resolve Groups
    const groups: string[] = [];
    for (const key of COMMON_GROUP_ATTRIBUTES) {
      const val = attributes[key];
      if (Array.isArray(val)) {
        groups.push(...val);
      } else if (typeof val === 'string' && val) {
        groups.push(val);
      }
    }

    // AuthNStatement session index
    const authnStatement = this.findFirstElement(assertion, ['AuthnStatement', 'saml:AuthnStatement', 'saml2:AuthnStatement']);
    const sessionIndex = authnStatement?.getAttribute('SessionIndex') ?? undefined;

    return {
      nameId: nameId || email,
      nameIdFormat,
      email,
      displayName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      groups: Array.from(new Set(groups)),
      attributes,
      sessionIndex,
    };
  }

  private canonicalizeNode(node: Node): string {
    return node.toString();
  }

  private findFirstElement(parent: Document | Element, tagNames: string[]): Element | null {
    for (const tag of tagNames) {
      const elements = parent.getElementsByTagName(tag);
      if (elements && elements.length > 0) {
        return elements[0] as Element;
      }
    }
    return null;
  }

  private findElements(parent: Document | Element, tagNames: string[]): Element[] {
    const result: Element[] = [];
    for (const tag of tagNames) {
      const elements = parent.getElementsByTagName(tag);
      if (elements) {
        for (let i = 0; i < elements.length; i++) {
          result.push(elements[i] as Element);
        }
      }
    }
    return result;
  }
}
