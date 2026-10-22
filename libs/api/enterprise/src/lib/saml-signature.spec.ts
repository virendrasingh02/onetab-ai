import { createRequire } from 'node:module';
import { SignedXml } from 'xml-crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SamlService } from './saml.service.js';

// node-forge is only used here to mint a throwaway signing certificate.
const forge = createRequire(import.meta.url)('node-forge');

const AUDIENCE = 'https://app.example.com/sp';
const NS = `xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`;

let keyPem = '';
let certPem = '';

beforeAll(() => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attrs = [{ name: 'commonName', value: 'idp.test' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  certPem = forge.pki.certificateToPem(cert);
});

function assertion(id: string, email: string) {
  const until = new Date(Date.now() + 300_000).toISOString();
  return `<saml:Assertion ID="${id}" Version="2.0"><saml:Issuer>idp</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID></saml:Subject><saml:Conditions NotOnOrAfter="${until}"><saml:AudienceRestriction><saml:Audience>${AUDIENCE}</saml:Audience></saml:AudienceRestriction></saml:Conditions></saml:Assertion>`;
}

function response(inner: string) {
  return `<samlp:Response ${NS} ID="_r1"><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>${inner}</samlp:Response>`;
}

function signAssertion(xml: string, algorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') {
  const sig = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: algorithm,
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='Issuer']", action: 'after' },
  });
  return sig.getSignedXml();
}

const run = (xml: string) =>
  new SamlService().validateSamlResponse({
    samlResponseBase64: Buffer.from(xml).toString('base64'),
    certificatePem: certPem,
    expectedAudience: AUDIENCE,
  });

describe('SAML signature verification', () => {
  it('accepts a correctly signed assertion', async () => {
    const claims = await run(signAssertion(response(assertion('_a1', 'alice@corp.com'))));
    expect(claims.nameId).toBe('alice@corp.com');
  });

  it('rejects an assertion modified after signing (digest mismatch)', async () => {
    const signed = signAssertion(response(assertion('_a1', 'alice@corp.com')));
    await expect(run(signed.replace('alice@corp.com', 'admin@victim.com'))).rejects.toThrow();
  });

  it('is not fooled by a forged assertion wrapped around a valid signed one', async () => {
    const signed = signAssertion(response(assertion('_a1', 'alice@corp.com')));
    const forged = assertion('_evil', 'admin@victim.com');
    const wrapped = signed.replace('<samlp:Status>', `<samlp:Status>`).replace(
      /(<\/samlp:Status>)/,
      `$1${forged}`,
    );
    // Either rejected outright, or resolved from the signed bytes — never the forgery.
    const outcome = await run(wrapped).then(
      (c) => c.nameId,
      () => 'rejected',
    );
    expect(outcome).not.toBe('admin@victim.com');
  });

  it('rejects a signature reused on a different assertion id', async () => {
    const signed = signAssertion(response(assertion('_a1', 'alice@corp.com')));
    await expect(run(signed.replace('ID="_a1"', 'ID="_a2"'))).rejects.toThrow();
  });

  it('rejects SHA-1 signatures', async () => {
    const signed = signAssertion(
      response(assertion('_a1', 'alice@corp.com')),
      'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    );
    await expect(run(signed)).rejects.toThrow();
  });

  it('rejects an audience that only contains the expected one', async () => {
    const signed = signAssertion(
      response(assertion('_a1', 'alice@corp.com').replace(AUDIENCE, `${AUDIENCE}/evil`)),
    );
    await expect(run(signed)).rejects.toThrow(/audience/i);
  });
});
