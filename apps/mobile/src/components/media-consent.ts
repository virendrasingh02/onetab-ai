import { Alert } from '../lib/alert';
import { secureStore } from '../lib/secure-store';

const CONSENT_KEY = 'onetab.mediaScanConsent';

/**
 * App Store 5.1.2(i): files sent to the safety model count as sharing with a
 * third-party AI, so people are told and agree before the first one goes.
 * Asked once. Declining cancels that share and nothing else.
 */
export async function confirmMediaScanning(): Promise<boolean> {
  if ((await secureStore.get(CONSENT_KEY)) === '1') return true;
  const agreed = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Safety check on shared files',
      'Before posting, photos, files and voice messages are checked by an automated safety service, currently run by NVIDIA. Files in end-to-end encrypted conversations are not checked.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Agree', onPress: () => resolve(true) },
      ],
    );
  });
  if (agreed) await secureStore.set(CONSENT_KEY, '1');
  return agreed;
}
