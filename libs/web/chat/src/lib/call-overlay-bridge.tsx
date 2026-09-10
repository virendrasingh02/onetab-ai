import { CallModal } from './call-modal.js';

/**
 * Mounts in the React provider tree under `<MatrixProvider>` to ensure
 * active or incoming Matrix calls are globally displayed.
 */
export function CallOverlayBridge() {
  return <CallModal />;
}
