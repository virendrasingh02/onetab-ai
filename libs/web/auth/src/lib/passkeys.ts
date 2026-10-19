import { ApiError, authApi, isTwoFactorChallenge } from '@org/api-client';
import type { WebAuthnCredentialDto } from '@org/types';
import type { PasskeyLoginVerifyInput, PasskeyRegisterVerifyInput } from '@org/validation';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './auth.store.js';
import { trackAccount } from './use-auth.js';

export { browserSupportsWebAuthn as browserSupportsPasskeys };

/** The person closed or timed out the browser prompt — not an error to show. */
export function isPasskeyCancelled(error: unknown): boolean {
  if (error instanceof WebAuthnError) {
    if (error.code === 'ERROR_CEREMONY_ABORTED') return true;
    // Cancel / timeout surface as a passed-through `NotAllowedError`.
    return (error.cause as Error | undefined)?.name === 'NotAllowedError';
  }
  return error instanceof Error && error.name === 'NotAllowedError';
}

/** A message for a failed passkey ceremony, or `null` when it was cancelled. */
export function passkeyErrorMessage(error: unknown): string | null {
  if (isPasskeyCancelled(error)) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof WebAuthnError) {
    if (error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
      return 'This device already has a passkey for your account.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Passkey request failed.';
}

/**
 * Adds a passkey to the signed-in account: server-issued options → the
 * browser's WebAuthn prompt → server-side attestation check.
 */
export async function registerPasskey(
  deviceName?: string,
): Promise<WebAuthnCredentialDto> {
  const { options, challengeToken } = await authApi.getWebAuthnRegistrationOptions();
  const response = await startRegistration({
    optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
  });
  return authApi.registerWebAuthn({
    challengeToken,
    deviceName,
    response: response as unknown as PasskeyRegisterVerifyInput['response'],
  });
}

/**
 * Passkey sign-in with a discoverable credential (no email needed). Resolves
 * like `useLogin`: a session, or a two-factor challenge for the code step.
 */
export function useSignInWithPasskey() {
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { options, challengeToken } = await authApi.getWebAuthnLoginOptions();
      const response = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
      });
      return authApi.loginWithWebAuthn({
        challengeToken,
        response: response as unknown as PasskeyLoginVerifyInput['response'],
      });
    },
    onSuccess: (data) => {
      if (isTwoFactorChallenge(data)) return;
      trackAccount(data.user, data.accessToken, data.refreshToken);
      setSession(data.user, data.accessToken);
      // Anything cached for a previous account must not leak into this one.
      queryClient.clear();
    },
  });
}
