import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricSupport {
  available: boolean;
  label: string;
}

/** Browsers have no OS owner check to call, so the lock is native only. */
const unsupported = Platform.OS === 'web';

export async function biometricSupport(): Promise<BiometricSupport> {
  if (unsupported) return { available: false, label: 'Biometrics' };
  const [hasHardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
  );
  return {
    available: hasHardware && enrolled,
    label: face ? 'Face ID' : 'Biometrics',
  };
}

/**
 * Asks the OS to verify the owner. The device passcode is allowed as a
 * fallback so a failed sensor never locks someone out of their own session.
 */
export async function authenticate(
  reason = 'Unlock Onetab AI',
): Promise<boolean> {
  // Never "verified" without a check — a web build cannot turn the lock on.
  if (unsupported) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}
