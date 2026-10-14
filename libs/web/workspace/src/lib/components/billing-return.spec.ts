import { beforeEach, describe, expect, it } from 'vitest';
import { clearReturnTo, isSafeReturnTo, readReturnTo, rememberReturnTo } from './billing-return.js';

describe('billing returnTo', () => {
  beforeEach(() => sessionStorage.clear());

  it('accepts same-site and localhost targets', () => {
    expect(isSafeReturnTo('http://localhost:4202/agents/1', 'app.onetab.ai')).not.toBeNull();
    expect(isSafeReturnTo('https://studio.onetab.ai/create', 'app.onetab.ai')).not.toBeNull();
    expect(isSafeReturnTo('https://app.onetab.ai/x', 'app.onetab.ai')).not.toBeNull();
  });

  it('rejects other origins, lookalike suffixes and non-http schemes', () => {
    expect(isSafeReturnTo('https://evil.com/x', 'app.onetab.ai')).toBeNull();
    expect(isSafeReturnTo('https://evil-onetab.ai/x', 'app.onetab.ai')).toBeNull();
    expect(isSafeReturnTo('https://onetab.ai.evil.com/x', 'app.onetab.ai')).toBeNull();
    expect(isSafeReturnTo('javascript:alert(1)', 'app.onetab.ai')).toBeNull();
  });

  it('remembers only valid targets and can clear them', () => {
    rememberReturnTo('https://evil.com/steal');
    expect(readReturnTo()).toBeNull();
    rememberReturnTo('http://localhost:4202/agents/1');
    expect(readReturnTo()?.href).toBe('http://localhost:4202/agents/1');
    clearReturnTo();
    expect(readReturnTo()).toBeNull();
  });
});
