import { VerificationManager } from './verification.js';
import { MatrixError, type VerificationRequestSummary } from './types.js';

/**
 * The SDK's verification objects are two chained event emitters. These fakes
 * reproduce that shape — request emits `change`, verifier emits `show_sas` —
 * so the manager is exercised through the same transitions a homeserver drives.
 */

type Handler = (...args: unknown[]) => void;

class FakeEmitter {
  private readonly handlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)?.add(handler);
    return this;
  }

  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  fire(event: string, ...args: unknown[]) {
    for (const handler of [...(this.handlers.get(event) ?? [])]) {
      handler(...args);
    }
  }

  listenerCount(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }
}

class FakeVerifier extends FakeEmitter {
  verify = vi.fn().mockResolvedValue(undefined);
  getShowSasCallbacks = vi.fn().mockReturnValue(null);
}

class FakeRequest extends FakeEmitter {
  transactionId: string | undefined = 'txn-1';
  otherUserId = '@bob:example.org';
  otherDeviceId: string | undefined = 'DEVICE_B';
  phase = 2; // Requested
  verifier: FakeVerifier | undefined = undefined;

  accept = vi.fn().mockResolvedValue(undefined);
  cancel = vi.fn().mockResolvedValue(undefined);
  startVerification = vi.fn(async () => {
    this.verifier = new FakeVerifier();
    this.phase = 4; // Started
    return this.verifier;
  });

  /** Moves to a phase and emits the change the manager listens for. */
  moveTo(phase: number) {
    this.phase = phase;
    this.fire('change');
  }
}

function setup(request = new FakeRequest()) {
  const emitted: VerificationRequestSummary[] = [];
  const crypto = {
    requestDeviceVerification: vi.fn().mockResolvedValue(request),
    requestOwnUserVerification: vi.fn().mockResolvedValue(request),
    requestVerificationDM: vi.fn().mockResolvedValue(request),
  };

  const manager = new VerificationManager(
    () => crypto as never,
    () => '@alice:example.org',
    (summary) => emitted.push(summary),
  );

  return { manager, request, crypto, emitted };
}

describe('VerificationManager', () => {
  it('publishes a summary as soon as a request is tracked', () => {
    const { manager, request, emitted } = setup();

    const summary = manager.track(request as never);

    expect(summary.phase).toBe('requested');
    expect(summary.otherUserId).toBe('@bob:example.org');
    expect(summary.otherDeviceId).toBe('DEVICE_B');
    expect(emitted).toHaveLength(1);
  });

  it('maps every SDK phase onto the domain phase', () => {
    const { manager, request, emitted } = setup();
    manager.track(request as never);

    // Unsent(1) and Requested(2) both read as "requested" to the UI.
    for (const [sdkPhase, expected] of [
      [1, 'requested'],
      [3, 'ready'],
      [4, 'started'],
    ] as const) {
      request.moveTo(sdkPhase);
      expect(emitted.at(-1)?.phase).toBe(expected);
    }
  });

  it('tracks the same request only once', () => {
    const { manager, request, emitted } = setup();

    manager.track(request as never);
    manager.track(request as never);

    expect(emitted).toHaveLength(1);
    expect(manager.list()).toHaveLength(1);
  });

  it('surfaces the emoji once the verifier shows them', async () => {
    const { manager, request, emitted } = setup();
    manager.track(request as never);

    await manager.startSas('txn-1');
    request.verifier?.fire('show_sas', {
      sas: {
        emoji: [
          ['🐶', 'Dog'],
          ['🦄', 'Unicorn'],
        ],
      },
      confirm: vi.fn(),
      mismatch: vi.fn(),
    });

    expect(emitted.at(-1)?.emoji).toEqual([
      { symbol: '🐶', name: 'Dog' },
      { symbol: '🦄', name: 'Unicorn' },
    ]);
  });

  it('drives the verifier once a method is agreed', async () => {
    const { manager, request } = setup();
    manager.track(request as never);

    await manager.startSas('txn-1');

    expect(request.startVerification).toHaveBeenCalledWith('m.sas.v1');
    expect(request.verifier?.verify).toHaveBeenCalled();
  });

  it('attaches the verifier only once across repeated changes', async () => {
    const { manager, request } = setup();
    manager.track(request as never);
    await manager.startSas('txn-1');

    request.moveTo(4);
    request.moveTo(4);

    // A second attach would re-run verify() and double the SAS listeners.
    expect(request.verifier?.verify).toHaveBeenCalledTimes(1);
    expect(request.verifier?.listenerCount('show_sas')).toBe(1);
  });

  it('confirms through the SAS callbacks', async () => {
    const { manager, request } = setup();
    manager.track(request as never);
    await manager.startSas('txn-1');

    const confirm = vi.fn().mockResolvedValue(undefined);
    request.verifier?.fire('show_sas', {
      sas: { emoji: [] },
      confirm,
      mismatch: vi.fn(),
    });

    await manager.confirm('txn-1');
    expect(confirm).toHaveBeenCalled();
  });

  it('refuses to confirm before the emoji exist', async () => {
    const { manager, request } = setup();
    manager.track(request as never);

    await expect(manager.confirm('txn-1')).rejects.toBeInstanceOf(MatrixError);
  });

  it('reports a mismatch rather than a plain cancel', async () => {
    const { manager, request } = setup();
    manager.track(request as never);
    await manager.startSas('txn-1');

    const mismatch = vi.fn();
    request.verifier?.fire('show_sas', {
      sas: { emoji: [] },
      confirm: vi.fn(),
      mismatch,
    });

    manager.mismatch('txn-1');

    // A mismatch means a possible MITM, so it must not degrade to `cancel()`.
    expect(mismatch).toHaveBeenCalled();
    expect(request.cancel).not.toHaveBeenCalled();
  });

  it('forgets a request once it completes, and detaches its listener', () => {
    const { manager, request } = setup();
    manager.track(request as never);

    request.moveTo(6); // Done

    expect(manager.get('txn-1')).toBeNull();
    expect(manager.list()).toEqual([]);
    expect(request.listenerCount('change')).toBe(0);
  });

  it('forgets a cancelled request too', () => {
    const { manager, request } = setup();
    manager.track(request as never);

    request.moveTo(5); // Cancelled

    expect(manager.list()).toEqual([]);
  });

  it('re-keys once the server assigns a transaction id', () => {
    const request = new FakeRequest();
    request.transactionId = undefined;
    const { manager } = setup(request);

    const summary = manager.track(request as never);
    expect(summary.id).toMatch(/^pending-/);

    request.transactionId = 'txn-late';
    request.moveTo(3);

    // The generated id is replaced, not duplicated.
    expect(manager.get('txn-late')?.phase).toBe('ready');
    expect(manager.list()).toHaveLength(1);
  });

  it('rejects actions on an unknown verification', async () => {
    const { manager } = setup();

    await expect(manager.accept('nope')).rejects.toBeInstanceOf(MatrixError);
    await expect(manager.cancel('nope')).rejects.toBeInstanceOf(MatrixError);
    expect(() => manager.mismatch('nope')).toThrow(MatrixError);
  });

  it('raises ENCRYPTION when crypto is unavailable', async () => {
    const manager = new VerificationManager(
      () => undefined,
      () => '@alice:example.org',
      () => undefined,
    );

    await expect(manager.requestOwnDevice('D')).rejects.toMatchObject({
      code: 'ENCRYPTION',
    });
  });

  it('raises SESSION_EXPIRED when signed out', async () => {
    const { crypto } = setup();
    const manager = new VerificationManager(
      () => crypto as never,
      () => null,
      () => undefined,
    );

    await expect(manager.requestOwnDevice('D')).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('verifies our own device against our own user id', async () => {
    const { manager, crypto } = setup();

    await manager.requestOwnDevice('DEVICE_B');

    expect(crypto.requestDeviceVerification).toHaveBeenCalledWith(
      '@alice:example.org',
      'DEVICE_B',
    );
  });

  it('uses in-room verification for another user', async () => {
    const { manager, crypto } = setup();

    await manager.requestUser('@bob:example.org', '!dm:example.org');

    expect(crypto.requestVerificationDM).toHaveBeenCalledWith(
      '@bob:example.org',
      '!dm:example.org',
    );
  });

  it('normalises SDK failures into MatrixError', async () => {
    const { manager, crypto } = setup();
    crypto.requestDeviceVerification.mockRejectedValue({
      errcode: 'M_FORBIDDEN',
    });

    await expect(manager.requestOwnDevice('D')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('drops every listener on dispose', () => {
    const { manager, request } = setup();
    manager.track(request as never);

    manager.dispose();

    expect(request.listenerCount('change')).toBe(0);
    expect(manager.list()).toEqual([]);
  });
});
