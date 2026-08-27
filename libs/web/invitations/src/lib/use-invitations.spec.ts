import { describe, expect, it } from 'vitest';
import { queryKeys } from '@org/api-client';

describe('use-invitations query keys', () => {
  it('generates correct invitation query keys with filters', () => {
    const wsId = 'ws_abc';
    expect(queryKeys.invitations.all(wsId)).toEqual(['invitations', wsId]);
    expect(queryKeys.invitations.list(wsId, { status: 'PENDING' })).toEqual([
      'invitations',
      wsId,
      'list',
      { status: 'PENDING' },
    ]);
    expect(queryKeys.invitations.links(wsId)).toEqual([
      'invitations',
      wsId,
      'links',
    ]);
    expect(queryKeys.invitations.preview('token123')).toEqual([
      'invitations',
      'preview',
      'token123',
    ]);
  });
});
