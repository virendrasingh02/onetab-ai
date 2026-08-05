import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the architectural promise of this package: Matrix stays behind it.
 *
 * These are the rules that make the transport replaceable. They are cheap to
 * violate accidentally — one convenience re-export is all it takes — so they
 * are asserted rather than documented.
 */

const LIB_DIR = join(import.meta.dirname);
const SRC_DIR = join(LIB_DIR, '..');

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

describe('package isolation', () => {
  it('does not re-export anything from matrix-js-sdk in the public barrel', () => {
    const barrel = read(join(SRC_DIR, 'index.ts'));

    // A bare `export ... from 'matrix-js-sdk'` would leak SDK types to callers.
    expect(barrel).not.toMatch(/from\s+['"]matrix-js-sdk['"]/);
    expect(barrel).not.toMatch(/export\s+\*\s+from\s+['"]matrix-js-sdk/);
  });

  it('confines SDK imports to the adapter modules', () => {
    // Only shipped modules matter; specs legitimately build SDK-shaped fakes.
    const allowed = new Set([
      'matrix-client.ts',
      'mappers.ts',
      'verification.ts',
    ]);

    // Deep imports count too: crypto lives at `matrix-js-sdk/lib/crypto-api`,
    // so matching only the bare specifier would let the SDK in through a side
    // door.
    const offenders = readdirSync(LIB_DIR)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .filter((file) => !allowed.has(file))
      .filter((file) =>
        /from\s+['"]matrix-js-sdk(\/[^'"]*)?['"]/.test(
          read(join(LIB_DIR, file)),
        ),
      );

    expect(offenders).toEqual([]);
  });

  it('exposes only domain types from the barrel', () => {
    const barrel = read(join(SRC_DIR, 'index.ts'));

    // Whole-identifier matches: `MatrixEventListener` is ours, `MatrixEvent`
    // is the SDK's, and a substring check cannot tell them apart.
    for (const leaked of [
      'MatrixEvent',
      'ICreateClientOpts',
      'ISendEventResponse',
      'EventTimeline',
      'SyncState',
      'RoomEvent',
      'ClientEvent',
    ]) {
      expect(barrel).not.toMatch(new RegExp(`\\b${leaked}\\b(?![A-Za-z0-9_])`));
    }
  });

  it('routes every SDK failure through MatrixError', () => {
    const client = read(join(LIB_DIR, 'matrix-client.ts'));

    // Every catch must normalise; a bare `throw error` would surface a raw
    // SDK error to the application.
    expect(client).not.toMatch(/catch\s*\(\s*error\s*\)\s*\{\s*throw error;/);
  });
});
