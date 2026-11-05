import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { appConfig } from '../lib/config';
import { AI_CONSENT_VERSION, hasAiConsent } from '../lib/safety-core';
import { secureStore } from '../lib/secure-store';
import { spacing } from '../theme/tokens';
import {
  AppText,
  Button,
  Card,
  LoadingState,
  Screen,
  SectionHeader,
} from './ui';

const CONSENT_KEY = 'onetab.aiConsent';

export const readAiConsent = async (): Promise<boolean> =>
  hasAiConsent(await secureStore.get(CONSENT_KEY));

export const writeAiConsent = async (granted: boolean): Promise<void> => {
  if (granted) await secureStore.set(CONSENT_KEY, AI_CONSENT_VERSION);
  else await secureStore.remove(CONSENT_KEY);
};

/**
 * App Store 5.1.2(i): personal data may reach a third-party AI only after that
 * is disclosed and the person explicitly agrees. Every AI screen sits behind
 * this; declining leaves the rest of the app untouched, and Settings can take
 * the permission back.
 */
function AiConsentPrompt({ onAgree }: { onAgree: () => void }) {
  const router = useRouter();
  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader title="Share data with AI services?" />
      <Card>
        <AppText variant="body">
          To answer you, Onetab AI sends what you type, any files or images you
          attach, and the workspace content you ask about to the AI provider
          running the selected model. That can be OpenAI, Anthropic, Google, or
          another provider your workspace set up.
        </AppText>
        <AppText variant="muted">
          Those providers process this data to produce a response. You can turn
          this off at any time in Settings. AI features then stop working in
          this app until you agree again.
        </AppText>
      </Card>
      <View style={styles.actions}>
        <Button label="Agree and continue" onPress={onAgree} />
        <Button
          label="Not now"
          variant="secondary"
          onPress={() => router.back()}
        />
        {appConfig.privacyUrl ? (
          <Button
            label="Privacy policy"
            variant="ghost"
            onPress={() =>
              void WebBrowser.openBrowserAsync(appConfig.privacyUrl as string)
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

export function withAiConsent<P extends object>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return function AiConsentGate(props: P) {
    const [granted, setGranted] = useState<boolean | null>(null);

    useEffect(() => {
      void readAiConsent().then(setGranted);
    }, []);

    if (granted === null) return <LoadingState />;
    if (!granted) {
      return (
        <AiConsentPrompt
          onAgree={() => {
            void writeAiConsent(true).then(() => setGranted(true));
          }}
        />
      );
    }
    return <Component {...props} />;
  };
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  actions: { gap: spacing.sm },
});
