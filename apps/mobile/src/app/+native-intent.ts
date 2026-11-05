import { nativePathForIncomingLink } from '../lib/deep-links';

/** Expo Router hook: every incoming URL passes through here before routing. */
export function redirectSystemPath({ path }: { path: string }): string {
  return nativePathForIncomingLink(path);
}
