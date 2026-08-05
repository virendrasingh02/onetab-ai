import {
  VerificationPhase,
  VerificationRequestEvent,
  VerifierEvent,
  type CryptoApi,
  type ShowSasCallbacks,
  type VerificationRequest,
  type Verifier,
} from 'matrix-js-sdk/lib/crypto-api/index.js';
import { toMatrixError } from './errors.js';
import { MatrixError, type VerificationRequestSummary } from './types.js';

/**
 * Interactive device verification (SAS / emoji comparison).
 *
 * This is the other half of `bootstrapCrossSigning`: cross-signing publishes
 * the keys, verification is how two devices decide to trust each other. Both
 * live behind the client so the UI never touches `matrix-js-sdk` — it renders
 * a `VerificationRequestSummary` and calls four methods.
 *
 * The SDK models this as a state machine spread across two objects: a
 * `VerificationRequest` (the negotiation) and, once a method is agreed, a
 * `Verifier` (the actual key exchange). Emoji only exist on the second one,
 * and only after the peers have exchanged keys. This module flattens both into
 * a single summary with one `phase` field, so consumers do not have to know
 * that distinction exists.
 */

/** The only method we offer. QR requires a camera and a scanning UI. */
const SAS_METHOD = 'm.sas.v1';

function toPhase(phase: VerificationPhase): VerificationRequestSummary['phase'] {
  switch (phase) {
    case VerificationPhase.Ready:
      return 'ready';
    case VerificationPhase.Started:
      return 'started';
    case VerificationPhase.Cancelled:
      return 'cancelled';
    case VerificationPhase.Done:
      return 'done';
    // `Unsent` is a request we have built but not yet sent; to the UI it is
    // indistinguishable from one awaiting a response.
    case VerificationPhase.Unsent:
    case VerificationPhase.Requested:
    default:
      return 'requested';
  }
}

interface Tracked {
  request: VerificationRequest;
  /** Present once the SAS is ready to show; holds confirm/mismatch. */
  sas: ShowSasCallbacks | null;
  verifier: Verifier | null;
  /** Unsubscribes the request listener when the flow reaches a terminal phase. */
  detach: () => void;
}

export type VerificationListener = (
  summary: VerificationRequestSummary,
) => void;

export class VerificationManager {
  private readonly tracked = new Map<string, Tracked>();
  private counter = 0;

  constructor(
    private readonly getCrypto: () => CryptoApi | undefined,
    private readonly getUserId: () => string | null,
    private readonly emit: VerificationListener,
  ) {}

  private requireCrypto(): CryptoApi {
    const crypto = this.getCrypto();
    if (!crypto) {
      throw new MatrixError('ENCRYPTION', 'Encryption is not available.');
    }
    return crypto;
  }

  private requireTracked(id: string): Tracked {
    const entry = this.tracked.get(id);
    if (!entry) {
      throw new MatrixError('NOT_FOUND', 'That verification is no longer active.');
    }
    return entry;
  }

  /**
   * The id the UI holds on to.
   *
   * `transactionId` is undefined until the first event goes over the wire, so
   * a locally-created request needs a stand-in until the server assigns one.
   */
  private idFor(request: VerificationRequest): string {
    for (const [id, entry] of this.tracked) {
      if (entry.request === request) return id;
    }
    return request.transactionId ?? `pending-${++this.counter}`;
  }

  private summarise(id: string, entry: Tracked): VerificationRequestSummary {
    return {
      id,
      otherUserId: entry.request.otherUserId,
      otherDeviceId: entry.request.otherDeviceId,
      emoji: entry.sas?.sas.emoji?.map(([symbol, name]) => ({ symbol, name })),
      phase: toPhase(entry.request.phase),
    };
  }

  private publish(id: string, entry: Tracked): void {
    this.emit(this.summarise(id, entry));
  }

  /**
   * Brings a request under management and starts emitting updates for it.
   *
   * Called for both directions: requests we initiate, and requests pushed to us
   * by the homeserver when another device wants to verify.
   */
  track(request: VerificationRequest): VerificationRequestSummary {
    const existingId = this.idFor(request);
    const existing = this.tracked.get(existingId);
    if (existing) return this.summarise(existingId, existing);

    const onChange = () => this.handleChange(request);
    request.on(VerificationRequestEvent.Change, onChange);

    const entry: Tracked = {
      request,
      sas: null,
      verifier: null,
      detach: () => request.off(VerificationRequestEvent.Change, onChange),
    };

    this.tracked.set(existingId, entry);
    // A request can arrive already in `Started` when we were slow to attach.
    this.attachVerifier(existingId, entry);
    this.publish(existingId, entry);

    return this.summarise(existingId, entry);
  }

  private handleChange(request: VerificationRequest): void {
    const id = this.idFor(request);
    const entry = this.tracked.get(id);
    if (!entry) return;

    // The real transaction id lands after the first event; re-key so the id the
    // UI was given keeps resolving.
    const realId = request.transactionId;
    if (realId && realId !== id) {
      this.tracked.delete(id);
      this.tracked.set(realId, entry);
    }

    const currentId = realId ?? id;
    this.attachVerifier(currentId, entry);
    this.publish(currentId, entry);

    if (
      request.phase === VerificationPhase.Done ||
      request.phase === VerificationPhase.Cancelled
    ) {
      entry.detach();
      this.tracked.delete(currentId);
    }
  }

  /**
   * Wires up the verifier once a method has been agreed.
   *
   * Idempotent: `Change` fires several times in the `Started` phase and only
   * the first should attach listeners or call `verify()`.
   */
  private attachVerifier(id: string, entry: Tracked): void {
    const verifier = entry.request.verifier;
    if (!verifier || entry.verifier === verifier) return;

    entry.verifier = verifier;

    verifier.on(VerifierEvent.ShowSas, (sas: ShowSasCallbacks) => {
      entry.sas = sas;
      this.publish(id, entry);
    });

    // `verify()` resolves when both sides confirm and rejects on cancellation.
    // The rejection is expected traffic, not a fault: the phase change has
    // already been published, so it is swallowed rather than surfaced.
    void verifier.verify().catch(() => undefined);
  }

  // --- actions --------------------------------------------------------------

  /**
   * Asks another of *our own* devices to verify this one.
   *
   * Self-verification is what unlocks history and key backup on a new login,
   * which is the case that matters for onboarding.
   */
  async requestOwnDevice(deviceId: string): Promise<VerificationRequestSummary> {
    const crypto = this.requireCrypto();
    const userId = this.getUserId();
    if (!userId) {
      throw new MatrixError('SESSION_EXPIRED', 'Not signed in to Matrix.');
    }

    try {
      return this.track(
        await crypto.requestDeviceVerification(userId, deviceId),
      );
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  /** Starts verification across all of our own other devices at once. */
  async requestOwnUser(): Promise<VerificationRequestSummary> {
    const crypto = this.requireCrypto();
    try {
      return this.track(await crypto.requestOwnUserVerification());
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  /**
   * Verifies *another* user, over an existing DM room.
   *
   * Cross-user verification is in-room rather than to-device, so it needs the
   * DM to exist first — `getOrCreateDirectMessage` supplies the room id.
   */
  async requestUser(
    userId: string,
    roomId: string,
  ): Promise<VerificationRequestSummary> {
    const crypto = this.requireCrypto();
    try {
      return this.track(await crypto.requestVerificationDM(userId, roomId));
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  /** Accepts an incoming request, moving it to `ready`. */
  async accept(id: string): Promise<void> {
    try {
      await this.requireTracked(id).request.accept();
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  /**
   * Chooses emoji comparison, moving the flow to `started`.
   *
   * Only one side needs to call this; the other is pulled in automatically when
   * the `m.key.verification.start` event arrives.
   */
  async startSas(id: string): Promise<void> {
    const entry = this.requireTracked(id);
    try {
      await entry.request.startVerification(SAS_METHOD);
      // `startVerification` resolves with the same verifier that lands on the
      // request, so attaching from the request keeps one code path.
      this.attachVerifier(id, entry);
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  /** The user confirmed the emoji match on both screens. */
  async confirm(id: string): Promise<void> {
    const entry = this.requireTracked(id);
    if (!entry.sas) {
      throw new MatrixError('UNSUPPORTED', 'There is no emoji to confirm yet.');
    }
    try {
      await entry.sas.confirm();
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  /**
   * The emoji did not match.
   *
   * This is the security-critical path: a mismatch means someone is sitting in
   * the middle, so it cancels with `m.mismatched_sas` rather than a plain
   * cancel, which tells the other side why.
   */
  mismatch(id: string): void {
    const entry = this.requireTracked(id);
    if (!entry.sas) {
      throw new MatrixError('UNSUPPORTED', 'There is no emoji to reject yet.');
    }
    entry.sas.mismatch();
  }

  /** Declines or aborts, from any phase. */
  async cancel(id: string): Promise<void> {
    try {
      await this.requireTracked(id).request.cancel();
    } catch (error) {
      throw toMatrixError(error);
    }
  }

  get(id: string): VerificationRequestSummary | null {
    const entry = this.tracked.get(id);
    return entry ? this.summarise(id, entry) : null;
  }

  list(): VerificationRequestSummary[] {
    return [...this.tracked].map(([id, entry]) => this.summarise(id, entry));
  }

  /** Drops all listeners. Called when the client stops. */
  dispose(): void {
    for (const entry of this.tracked.values()) entry.detach();
    this.tracked.clear();
  }
}
